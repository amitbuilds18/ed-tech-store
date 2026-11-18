import { Entitlement, EntitlementScope, ProductType, Order, OrderItem } from '@prisma/client';
import { prisma } from '../prisma';

export type AccessState = 'OWNED' | 'UPGRADE' | 'BUY';

export interface ResolvedChapter {
  id: string;
  name: string;
  order: number;
  isFree: boolean;
  subjectId: string;
  state: 'OWNED' | 'BUY';
  ownedThrough?: 'FREE' | 'CHAPTER' | 'SUBJECT_PACK' | 'CLASS_PASS';
}

export interface ResolvedProduct {
  id: string;
  title: string;
  type: ProductType;
  targetId: string;
  originalPricePaise: number;
  pricePaise: number;
  creditPaise?: number;
  state: AccessState;
  active: boolean;
  expiresAt?: Date | null;
}

export type EntitlementWithOrder = Entitlement & {
  sourceOrder: (Order & { items: OrderItem[] }) | null;
};

export class EntitlementService {
  /**
   * Reads ONLY the Entitlement table to retrieve active entitlements for a user.
   * Entitlements must not be revoked, and if they have an expiration date, it must be in the future.
   */
  static async getUserActiveEntitlements(userId: string): Promise<EntitlementWithOrder[]> {
    const now = new Date();
    return prisma.entitlement.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      include: {
        sourceOrder: {
          include: {
            items: true,
          },
        },
      },
    });
  }

  /**
   * Resolves the access state of a chapter.
   * A chapter is OWNED if:
   * 1. It is marked as free (chapter.isFree === true)
   * 2. User has an active CLASS_PASS for the chapter's class
   * 3. User has an active SUBJECT entitlement for the chapter's subject
   * 4. User has a direct CHAPTER entitlement for this chapter
   */
  static resolveChapterAccess(
    entitlements: EntitlementWithOrder[],
    chapter: { id: string; isFree: boolean; subjectId: string },
    classId: string
  ): { state: 'OWNED' | 'BUY'; ownedThrough?: 'FREE' | 'CHAPTER' | 'SUBJECT_PACK' | 'CLASS_PASS' } {
    if (chapter.isFree) {
      return { state: 'OWNED', ownedThrough: 'FREE' };
    }

    // Check Class Pass
    const hasClassPass = entitlements.some(
      (e) => e.scope === EntitlementScope.CLASS_PASS && e.refId === classId
    );
    if (hasClassPass) {
      return { state: 'OWNED', ownedThrough: 'CLASS_PASS' };
    }

    // Check Subject Pack
    const hasSubjectPack = entitlements.some(
      (e) => e.scope === EntitlementScope.SUBJECT && e.refId === chapter.subjectId
    );
    if (hasSubjectPack) {
      return { state: 'OWNED', ownedThrough: 'SUBJECT_PACK' };
    }

    // Check Chapter Entitlement
    const hasChapter = entitlements.some(
      (e) => e.scope === EntitlementScope.CHAPTER && e.refId === chapter.id
    );
    if (hasChapter) {
      return { state: 'OWNED', ownedThrough: 'CHAPTER' };
    }

    return { state: 'BUY' };
  }

  /**
   * Resolves product access state and calculates upgrade credit where applicable.
   * - CHAPTER: If already owned via class pass, subject pack, or direct chapter entitlement -> OWNED. Else BUY.
   * - SUBJECT_PACK: If already owned via class pass or subject pack -> OWNED.
   *                 Else if user paid for chapters in this subject -> UPGRADE with credit.
   *                 Else BUY.
   * - PASS: If user currently has an active pass for the class -> OWNED. Else BUY.
   */
  static resolveProductState(
    entitlements: EntitlementWithOrder[],
    product: { id: string; title: string; type: ProductType; targetId: string; pricePaise: number; active: boolean },
    context: {
      chapterSubjectId?: string;
      chapterClassId?: string;
      subjectClassId?: string;
      subjectChapterIds?: string[];
    }
  ): ResolvedProduct {
    const base: ResolvedProduct = {
      id: product.id,
      title: product.title,
      type: product.type,
      targetId: product.targetId,
      originalPricePaise: product.pricePaise,
      pricePaise: product.pricePaise,
      state: 'BUY',
      active: product.active,
    };

    if (product.type === ProductType.CHAPTER) {
      const chapterId = product.targetId;
      const subjectId = context.chapterSubjectId;
      const classId = context.chapterClassId;

      const isOwned = entitlements.some((e) => {
        if (e.scope === EntitlementScope.CHAPTER && e.refId === chapterId) return true;
        if (subjectId && e.scope === EntitlementScope.SUBJECT && e.refId === subjectId) return true;
        if (classId && e.scope === EntitlementScope.CLASS_PASS && e.refId === classId) return true;
        return false;
      });

      if (isOwned) {
        base.state = 'OWNED';
      }
      return base;
    }

    if (product.type === ProductType.SUBJECT_PACK) {
      const subjectId = product.targetId;
      const classId = context.subjectClassId;

      // 1. Fully owned if subject pack or class pass exists
      const isFullyOwned = entitlements.some((e) => {
        if (e.scope === EntitlementScope.SUBJECT && e.refId === subjectId) return true;
        if (classId && e.scope === EntitlementScope.CLASS_PASS && e.refId === classId) return true;
        return false;
      });

      if (isFullyOwned) {
        base.state = 'OWNED';
        return base;
      }

      // 2. Check for Upgrade Credit from individual chapters purchased in this subject
      const subjectChapterIds = context.subjectChapterIds || [];
      let totalPaidForChapters = 0;

      for (const e of entitlements) {
        if (e.scope === EntitlementScope.CHAPTER && subjectChapterIds.includes(e.refId)) {
          // Check order items for exact amount paid
          if (e.sourceOrder && e.sourceOrder.items) {
            for (const item of e.sourceOrder.items) {
              totalPaidForChapters += item.pricePaise;
            }
          }
        }
      }

      if (totalPaidForChapters > 0) {
        base.state = 'UPGRADE';
        base.creditPaise = totalPaidForChapters;
        base.pricePaise = Math.max(0, product.pricePaise - totalPaidForChapters);
      }

      return base;
    }

    if (product.type === ProductType.MONTHLY_PASS || product.type === ProductType.ANNUAL_PASS) {
      const classId = product.targetId;
      const activePass = entitlements.find(
        (e) => e.scope === EntitlementScope.CLASS_PASS && e.refId === classId
      );

      if (activePass) {
        base.state = 'OWNED';
        base.expiresAt = activePass.expiresAt;
      }

      return base;
    }

    return base;
  }
}
