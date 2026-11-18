import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { OrderStatus, ProductType } from '@prisma/client';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { checkoutSchema } from '../schemas/checkout.schema';
import { calculateCart, CartItem, UserEntitlementPaidInfo } from '../services/pricing';
import { EntitlementService } from '../services/entitlement.service';
import { createRazorpayOrder, RAZORPAY_KEY_ID } from '../services/razorpay.service';

const router = Router();

// Rate limiter for checkout: max 30 checkout creations per 15 minutes per IP
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many checkout attempts. Please try again later.' },
});

// Guard all checkout routes with authentication
router.use(requireAuth);

// Helper to load DB products, user entitlements, validate coupon, and run calculateCart
async function processCartCalculation(
  userId: string,
  rawItems: { productId: string }[],
  couponCode?: string
) {
  // 1. Load products strictly from the database (NEVER accept client prices)
  const productIds: string[] = rawItems.map((i) => i.productId);
  const dbProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      active: true,
    },
  });

  if (dbProducts.length !== productIds.length) {
    return { error: 'One or more selected products are invalid or inactive', status: 400 };
  }

  // 2. Fetch hierarchy context for products (chapter, subject, class) to support upgrade credits and ownership checks
  const chapterIds = dbProducts
    .filter((p) => p.type === ProductType.CHAPTER)
    .map((p) => p.targetId);

  const subjectIds = dbProducts
    .filter((p) => p.type === ProductType.SUBJECT_PACK)
    .map((p) => p.targetId);

  const [chapters, subjects] = await Promise.all([
    chapterIds.length > 0
      ? prisma.chapter.findMany({
          where: { id: { in: chapterIds } },
          include: { subject: { select: { id: true, classId: true } } },
        })
      : [],
    subjectIds.length > 0
      ? prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          include: {
            class: { select: { id: true } },
            chapters: { select: { id: true } },
          },
        })
      : [],
  ]);

  // Construct enriched CartItems for calculateCart
  const cartItems: CartItem[] = dbProducts.map((p) => {
    const item: CartItem = {
      id: p.id,
      productId: p.id,
      title: p.title,
      type: p.type,
      targetId: p.targetId,
      pricePaise: p.pricePaise, // Source of truth: DB price in paise
    };

    if (p.type === ProductType.CHAPTER) {
      const ch = chapters.find((c) => c.id === p.targetId);
      if (ch) {
        item.chapterSubjectId = ch.subject.id;
        item.chapterClassId = ch.subject.classId;
      }
    } else if (p.type === ProductType.SUBJECT_PACK) {
      const subj = subjects.find((s) => s.id === p.targetId);
      if (subj) {
        item.subjectClassId = subj.class.id;
        item.subjectChapterIds = subj.chapters.map((c) => c.id);
      }
    }

    return item;
  });

  // 3. Load user entitlements with amounts paid from the Entitlement table
  const activeEntitlements = await EntitlementService.getUserActiveEntitlements(userId);

  const entChapterIds = activeEntitlements
    .filter((e) => e.scope === 'CHAPTER')
    .map((e) => e.refId);

  const entChapters =
    entChapterIds.length > 0
      ? await prisma.chapter.findMany({
          where: { id: { in: entChapterIds } },
          select: { id: true, subjectId: true },
        })
      : [];

  const userEntitlementsWithPaidAmounts: UserEntitlementPaidInfo[] = activeEntitlements.map((e) => {
    let paid = 0;
    if (e.sourceOrder && e.sourceOrder.items) {
      for (const it of e.sourceOrder.items) {
        paid += it.pricePaise;
      }
    }

    const info: UserEntitlementPaidInfo = {
      scope: e.scope,
      refId: e.refId,
      paidPaise: paid,
      expiresAt: e.expiresAt,
      revokedAt: e.revokedAt,
    };

    if (e.scope === 'CHAPTER') {
      const found = entChapters.find((c) => c.id === e.refId);
      if (found) {
        info.subjectId = found.subjectId;
      }
    }

    return info;
  });

  // 4. Validate coupon if provided
  let couponRecord = null;
  if (couponCode) {
    couponRecord = await prisma.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });

    if (!couponRecord) {
      return { error: 'Invalid coupon code', status: 400 };
    }
  }

  // 5. Calculate cart totals, upgrade credits, discounts, and GST split using pure pricing engine
  const now = new Date();
  const calculation = calculateCart(
    cartItems,
    userEntitlementsWithPaidAmounts,
    couponRecord,
    now
  );

  return { calculation };
}

// -------------------------------------------------------------
// POST /checkout/preview - Live calculation of cart, discount & GST
// -------------------------------------------------------------
router.post(
  '/preview',
  validateBody(checkoutSchema),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { items: rawItems, couponCode } = req.body;

    const result = await processCartCalculation(userId, rawItems, couponCode);
    if (result.error || !result.calculation) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }

    const calc = result.calculation;
    res.status(200).json({
      lines: calc.lines,
      subtotalPaise: calc.subtotalPaise,
      discountPaise: calc.discountPaise,
      totalPaise: calc.totalPaise,
      basePaise: calc.basePaise,
      gstPaise: calc.gstPaise,
    });
  }
);

// -------------------------------------------------------------
// POST /checkout - Initiate checkout and create Razorpay order
// -------------------------------------------------------------
router.post(
  '/',
  checkoutLimiter,
  validateBody(checkoutSchema),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { items: rawItems, couponCode } = req.body;

    const result = await processCartCalculation(userId, rawItems, couponCode);
    if (result.error || !result.calculation) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }

    const calculation = result.calculation;

    // If all items were already owned, drop count equals items count
    if (calculation.lines.length === 0) {
      res.status(400).json({
        error: 'All items in your cart are already owned and cannot be purchased again',
      });
      return;
    }

    // Create Razorpay order in test mode with amount in paise
    const receipt = `rcpt_${Date.now()}_${userId.slice(0, 6)}`;
    const rzpOrder = await createRazorpayOrder(calculation.totalPaise, receipt);

    // Save Order (status: CREATED) and OrderItems in database
    const order = await prisma.order.create({
      data: {
        userId,
        status: OrderStatus.CREATED,
        amountPaise: calculation.totalPaise,
        razorpayOrderId: rzpOrder.id,
        items: {
          create: calculation.lines.map((line) => ({
            productId: line.item.productId || line.item.id!,
            pricePaise: line.finalPricePaise,
          })),
        },
      },
    });

    // Return checkout payload to client (NEVER send key_secret to frontend)
    res.status(201).json({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amountPaise: calculation.totalPaise,
      subtotalPaise: calculation.subtotalPaise,
      discountPaise: calculation.discountPaise,
      keyId: RAZORPAY_KEY_ID,
    });
  }
);


export default router;
