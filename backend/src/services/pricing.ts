import { ProductType, EntitlementScope } from '@prisma/client';

export interface CartItem {
  id?: string;
  productId?: string;
  type: ProductType | 'CHAPTER' | 'SUBJECT_PACK' | 'MONTHLY_PASS' | 'ANNUAL_PASS';
  targetId: string;
  pricePaise: number;
  title?: string;
  chapterSubjectId?: string;
  chapterClassId?: string;
  subjectClassId?: string;
  subjectChapterIds?: string[];
}

export interface UserEntitlementPaidInfo {
  scope: EntitlementScope | 'CHAPTER' | 'SUBJECT' | 'CLASS_PASS';
  refId: string;
  paidPaise?: number;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  subjectId?: string;
}

export interface CouponInfo {
  code: string;
  discountPercent?: number | null;
  discountPaise?: number | null;
  active: boolean;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  usedCount?: number | null;
}

export interface CartLine {
  item: CartItem;
  originalPricePaise: number;
  creditPaise: number;
  finalPricePaise: number;
}

export interface CartCalculationResult {
  lines: CartLine[];
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  basePaise: number;
  gstPaise: number;
}

/**
 * PURE function to calculate cart totals, upgrade credits, coupon discounts,
 * and 18% GST split, dropping items the user already owns.
 */
export function calculateCart(
  items: CartItem[],
  userEntitlementsWithPaidAmounts: UserEntitlementPaidInfo[],
  coupon?: CouponInfo | null,
  now: Date = new Date()
): CartCalculationResult {
  // 1. Filter out active, unrevoked entitlements
  const activeEntitlements = (userEntitlementsWithPaidAmounts || []).filter((e) => {
    if (e.revokedAt) return false;
    if (e.expiresAt && e.expiresAt <= now) return false;
    return true;
  });

  // 2. Process cart items: drop already owned items, calculate upgrade credit
  const lines: CartLine[] = [];

  for (const item of items) {
    // Check if item is already owned
    const isOwned = isItemAlreadyOwned(item, activeEntitlements);
    if (isOwned) {
      // Rule: Drop items already owned (must not be offered or purchased again)
      continue;
    }

    let creditPaise = 0;

    // Rule: Subject pack price minus amount already paid for its chapters (min 0)
    if (item.type === 'SUBJECT_PACK') {
      const subjectId = item.targetId;
      const chapterIds = item.subjectChapterIds || [];

      for (const e of activeEntitlements) {
        if (e.scope === 'CHAPTER') {
          const belongsToSubject =
            e.subjectId === subjectId || chapterIds.includes(e.refId);
          if (belongsToSubject) {
            creditPaise += e.paidPaise || 0;
          }
        }
      }
    }

    const originalPricePaise = Math.round(item.pricePaise);
    const finalPricePaise = Math.max(0, originalPricePaise - creditPaise);

    lines.push({
      item,
      originalPricePaise,
      creditPaise,
      finalPricePaise,
    });
  }

  // 3. Calculate subtotal
  const subtotalPaise = lines.reduce((acc, l) => acc + l.finalPricePaise, 0);

  // 4. Calculate coupon discount
  let discountPaise = 0;

  if (coupon && isCouponValid(coupon, now)) {
    if (coupon.discountPercent && coupon.discountPercent > 0) {
      discountPaise = Math.round((subtotalPaise * coupon.discountPercent) / 100);
    } else if (coupon.discountPaise && coupon.discountPaise > 0) {
      discountPaise = Math.round(coupon.discountPaise);
    }
    // Discount cannot exceed subtotal
    discountPaise = Math.min(subtotalPaise, Math.max(0, discountPaise));
  }

  // 5. Total amount (inclusive of 18% GST)
  const totalPaise = Math.max(0, subtotalPaise - discountPaise);

  // 6. GST Split: total is GST inclusive
  // basePaise = Math.round(totalPaise * 100 / 118)
  // gstPaise = totalPaise - basePaise
  const basePaise = Math.round((totalPaise * 100) / 118);
  const gstPaise = totalPaise - basePaise;

  return {
    lines,
    subtotalPaise,
    discountPaise,
    totalPaise,
    basePaise,
    gstPaise,
  };
}

/**
 * Checks if a cart item is already owned by the user.
 * - Chapter: owned directly, or covered by subject pack or class pass.
 * - Subject pack: owned directly, or covered by class pass.
 */
function isItemAlreadyOwned(
  item: CartItem,
  activeEntitlements: UserEntitlementPaidInfo[]
): boolean {
  if (item.type === 'CHAPTER') {
    return activeEntitlements.some((e) => {
      // Direct chapter ownership
      if (e.scope === 'CHAPTER' && e.refId === item.targetId) {
        return true;
      }
      // Subject pack ownership covering this chapter
      if (
        e.scope === 'SUBJECT' &&
        item.chapterSubjectId &&
        e.refId === item.chapterSubjectId
      ) {
        return true;
      }
      // Class pass ownership covering this chapter
      if (
        e.scope === 'CLASS_PASS' &&
        item.chapterClassId &&
        e.refId === item.chapterClassId
      ) {
        return true;
      }
      return false;
    });
  }

  if (item.type === 'SUBJECT_PACK') {
    return activeEntitlements.some((e) => {
      // Direct subject pack ownership
      if (e.scope === 'SUBJECT' && e.refId === item.targetId) {
        return true;
      }
      // Class pass ownership covering this subject
      if (
        e.scope === 'CLASS_PASS' &&
        item.subjectClassId &&
        e.refId === item.subjectClassId
      ) {
        return true;
      }
      return false;
    });
  }

  // Note: Passes can be repurchased to extend from old expiry as per business rules
  return false;
}

/**
 * Validates if a coupon is eligible for discount
 */
function isCouponValid(coupon: CouponInfo, now: Date): boolean {
  if (!coupon.active) return false;
  if (coupon.expiresAt && coupon.expiresAt <= now) return false;
  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    coupon.usedCount !== null &&
    coupon.usedCount !== undefined &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    return false;
  }
  return true;
}
