import { Order, OrderStatus, ProductType, EntitlementScope } from '@prisma/client';
import { prisma } from '../prisma';

export interface PaymentDetails {
  razorpayPaymentId: string;
  razorpaySignature?: string;
  amountPaise: number;
  status: string; // e.g. "captured"
}

export interface SettleOrderResult {
  success: boolean;
  alreadyPaid?: boolean;
  error?: string;
}

/**
 * Settles an order inside a Prisma transaction with row-level locking (SELECT ... FOR UPDATE).
 * - Returns early if order is already marked PAID (idempotent).
 * - Verifies payment amount matches order.amountPaise before granting anything.
 * - Saves a Payment record.
 * - Marks the order as PAID.
 * - Grants entitlements exactly once.
 * - Extends class passes: newExpiry = max(now, existingExpiry) + 30 (or 365) days.
 */
export async function settleOrder(
  orderId: string,
  paymentDetails: PaymentDetails
): Promise<SettleOrderResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the order row with SELECT ... FOR UPDATE
    const lockedOrders = await tx.$queryRaw<Order[]>`
      SELECT * FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
    `;

    if (!lockedOrders || lockedOrders.length === 0) {
      return { success: false, error: 'Order not found' };
    }

    const order = lockedOrders[0];

    // 2. Return early if already paid (ensures idempotency across webhooks & verify calls)
    if (order.status === OrderStatus.PAID) {
      return { success: true, alreadyPaid: true };
    }

    // 3. Compare paid amount with order.amountPaise before granting
    if (paymentDetails.amountPaise !== order.amountPaise) {
      return {
        success: false,
        error: `Amount mismatch: expected ${order.amountPaise} paise, received ${paymentDetails.amountPaise} paise`,
      };
    }

    // 4. Save Payment record
    // If payment record with this razorpayPaymentId already exists, find or create
    const existingPayment = await tx.payment.findUnique({
      where: { razorpayPaymentId: paymentDetails.razorpayPaymentId },
    });

    if (!existingPayment) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          razorpayPaymentId: paymentDetails.razorpayPaymentId,
          razorpaySignature: paymentDetails.razorpaySignature || null,
          amountPaise: paymentDetails.amountPaise,
          status: paymentDetails.status,
        },
      });
    }

    // 5. Mark the order as PAID
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID },
    });

    // 6. Fetch order items with their product details to grant entitlements
    const orderItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
      include: { product: true },
    });

    const now = new Date();

    for (const item of orderItems) {
      const product = item.product;

      if (product.type === ProductType.CHAPTER) {
        // Lifetime access to single chapter
        await tx.entitlement.create({
          data: {
            userId: order.userId,
            scope: EntitlementScope.CHAPTER,
            refId: product.targetId,
            expiresAt: null, // Lifetime
            sourceOrderId: order.id,
          },
        });
      } else if (product.type === ProductType.SUBJECT_PACK) {
        // Lifetime access to all chapters in subject
        await tx.entitlement.create({
          data: {
            userId: order.userId,
            scope: EntitlementScope.SUBJECT,
            refId: product.targetId,
            expiresAt: null, // Lifetime
            sourceOrderId: order.id,
          },
        });
      } else if (
        product.type === ProductType.MONTHLY_PASS ||
        product.type === ProductType.ANNUAL_PASS
      ) {
        // Class Pass: 30 days (Monthly) or 365 days (Annual)
        const durationDays = product.type === ProductType.MONTHLY_PASS ? 30 : 365;
        const durationMs = durationDays * 24 * 60 * 60 * 1000;
        const classId = product.targetId;

        // Check if user already holds an unrevoked pass for this class
        const existingPass = await tx.entitlement.findFirst({
          where: {
            userId: order.userId,
            scope: EntitlementScope.CLASS_PASS,
            refId: classId,
            revokedAt: null,
          },
          orderBy: { expiresAt: 'desc' },
        });

        // Pass extension rule: newExpiry = max(now, existingExpiry) + 30 (or 365) days
        const baseTime =
          existingPass && existingPass.expiresAt && existingPass.expiresAt > now
            ? existingPass.expiresAt.getTime()
            : now.getTime();

        const newExpiry = new Date(baseTime + durationMs);

        if (existingPass) {
          // Extend existing pass
          await tx.entitlement.update({
            where: { id: existingPass.id },
            data: {
              expiresAt: newExpiry,
              sourceOrderId: order.id,
            },
          });
        } else {
          // Create new pass entitlement
          await tx.entitlement.create({
            data: {
              userId: order.userId,
              scope: EntitlementScope.CLASS_PASS,
              refId: classId,
              expiresAt: newExpiry,
              sourceOrderId: order.id,
            },
          });
        }
      }
    }

    return { success: true };
  });
}
