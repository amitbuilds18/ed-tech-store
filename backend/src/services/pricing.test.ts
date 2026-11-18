import { describe, it, expect } from 'vitest';
import { calculateCart, CartItem, UserEntitlementPaidInfo, CouponInfo } from './pricing';

describe('calculateCart Pure Function', () => {
  const fixedNow = new Date('2026-11-18T10:00:00Z');

  // 1. Upgrade Credit
  it('applies upgrade credit by subtracting amount paid for chapters from subject pack price', () => {
    const subjectId = 'subject-math-1';
    const ch1Id = 'ch-1';
    const ch2Id = 'ch-2';

    const items: CartItem[] = [
      {
        type: 'SUBJECT_PACK',
        targetId: subjectId,
        pricePaise: 19900, // ₹199
        subjectChapterIds: [ch1Id, ch2Id],
      },
    ];

    const entitlements: UserEntitlementPaidInfo[] = [
      {
        scope: 'CHAPTER',
        refId: ch1Id,
        subjectId: subjectId,
        paidPaise: 4900, // ₹49 paid previously
      },
    ];

    const result = calculateCart(items, entitlements, null, fixedNow);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].creditPaise).toBe(4900);
    expect(result.lines[0].originalPricePaise).toBe(19900);
    expect(result.lines[0].finalPricePaise).toBe(15000); // 19900 - 4900
    expect(result.subtotalPaise).toBe(15000);
    expect(result.totalPaise).toBe(15000);
  });

  // 2. Credit Above Price (Result 0)
  it('caps upgrade credit so final price never falls below 0 when credit exceeds price', () => {
    const subjectId = 'subject-science-1';
    const ch1 = 'ch-s1';
    const ch2 = 'ch-s2';
    const ch3 = 'ch-s3';
    const ch4 = 'ch-s4';
    const ch5 = 'ch-s5';

    const items: CartItem[] = [
      {
        type: 'SUBJECT_PACK',
        targetId: subjectId,
        pricePaise: 19900, // ₹199
        subjectChapterIds: [ch1, ch2, ch3, ch4, ch5],
      },
    ];

    // User previously bought 5 chapters @ 4900 paise each = 24500 paise
    const entitlements: UserEntitlementPaidInfo[] = [
      { scope: 'CHAPTER', refId: ch1, subjectId, paidPaise: 4900 },
      { scope: 'CHAPTER', refId: ch2, subjectId, paidPaise: 4900 },
      { scope: 'CHAPTER', refId: ch3, subjectId, paidPaise: 4900 },
      { scope: 'CHAPTER', refId: ch4, subjectId, paidPaise: 4900 },
      { scope: 'CHAPTER', refId: ch5, subjectId, paidPaise: 4900 },
    ];

    const result = calculateCart(items, entitlements, null, fixedNow);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].creditPaise).toBe(24500);
    expect(result.lines[0].originalPricePaise).toBe(19900);
    expect(result.lines[0].finalPricePaise).toBe(0); // Min 0
    expect(result.subtotalPaise).toBe(0);
    expect(result.totalPaise).toBe(0);
    expect(result.basePaise).toBe(0);
    expect(result.gstPaise).toBe(0);
  });

  // 3. Flat Coupon
  it('applies a flat coupon discount correctly', () => {
    const items: CartItem[] = [
      {
        type: 'CHAPTER',
        targetId: 'ch-3',
        pricePaise: 10000, // ₹100
      },
    ];

    const coupon: CouponInfo = {
      code: 'FLAT20',
      active: true,
      discountPaise: 2000, // ₹20 off
    };

    const result = calculateCart(items, [], coupon, fixedNow);

    expect(result.subtotalPaise).toBe(10000);
    expect(result.discountPaise).toBe(2000);
    expect(result.totalPaise).toBe(8000);
  });

  // 4. Percent Coupon
  it('applies a percentage coupon discount correctly', () => {
    const items: CartItem[] = [
      {
        type: 'CHAPTER',
        targetId: 'ch-4',
        pricePaise: 5000, // ₹50
      },
    ];

    const coupon: CouponInfo = {
      code: 'TENOFF',
      active: true,
      discountPercent: 10, // 10%
    };

    const result = calculateCart(items, [], coupon, fixedNow);

    expect(result.subtotalPaise).toBe(5000);
    expect(result.discountPaise).toBe(500); // 10% of 5000
    expect(result.totalPaise).toBe(4500);
  });

  // 5. Expired Coupon
  it('ignores expired coupon and applies zero discount', () => {
    const items: CartItem[] = [
      {
        type: 'CHAPTER',
        targetId: 'ch-5',
        pricePaise: 4900,
      },
    ];

    const expiredCoupon: CouponInfo = {
      code: 'EXPIRED10',
      active: true,
      discountPercent: 10,
      expiresAt: new Date('2026-11-17T10:00:00Z'), // Past date
    };

    const result = calculateCart(items, [], expiredCoupon, fixedNow);

    expect(result.subtotalPaise).toBe(4900);
    expect(result.discountPaise).toBe(0);
    expect(result.totalPaise).toBe(4900);
  });

  // 6. GST Split
  it('computes 18% inclusive GST split accurately with all integer values', () => {
    // Test Case A: Exactly 11800 paise (₹118) -> 10000 base + 1800 GST
    const itemsA: CartItem[] = [
      {
        type: 'CHAPTER',
        targetId: 'ch-gst-1',
        pricePaise: 11800,
      },
    ];
    const resultA = calculateCart(itemsA, [], null, fixedNow);
    expect(resultA.totalPaise).toBe(11800);
    expect(resultA.basePaise).toBe(10000);
    expect(resultA.gstPaise).toBe(1800);
    expect(resultA.basePaise + resultA.gstPaise).toBe(resultA.totalPaise);
    expect(Number.isInteger(resultA.basePaise)).toBe(true);
    expect(Number.isInteger(resultA.gstPaise)).toBe(true);

    // Test Case B: 19900 paise (₹199)
    // basePaise = Math.round(19900 * 100 / 118) = Math.round(16864.406) = 16864
    // gstPaise = 19900 - 16864 = 3036
    const itemsB: CartItem[] = [
      {
        type: 'SUBJECT_PACK',
        targetId: 'subj-gst-2',
        pricePaise: 19900,
      },
    ];
    const resultB = calculateCart(itemsB, [], null, fixedNow);
    expect(resultB.totalPaise).toBe(19900);
    expect(resultB.basePaise).toBe(16864);
    expect(resultB.gstPaise).toBe(3036);
    expect(resultB.basePaise + resultB.gstPaise).toBe(resultB.totalPaise);
    expect(Number.isInteger(resultB.basePaise)).toBe(true);
    expect(Number.isInteger(resultB.gstPaise)).toBe(true);
  });

  // 7. Drop Items Already Owned
  it('drops items that the user already owns from the cart', () => {
    const ownedChapterId = 'ch-owned-1';
    const unownedChapterId = 'ch-unowned-2';

    const items: CartItem[] = [
      {
        type: 'CHAPTER',
        targetId: ownedChapterId,
        pricePaise: 4900,
      },
      {
        type: 'CHAPTER',
        targetId: unownedChapterId,
        pricePaise: 4900,
      },
    ];

    const entitlements: UserEntitlementPaidInfo[] = [
      {
        scope: 'CHAPTER',
        refId: ownedChapterId,
      },
    ];

    const result = calculateCart(items, entitlements, null, fixedNow);

    // Owned chapter dropped; only unowned chapter remains
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].item.targetId).toBe(unownedChapterId);
    expect(result.subtotalPaise).toBe(4900);
    expect(result.totalPaise).toBe(4900);
  });
});
