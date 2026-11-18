import { EntitlementScope } from '@prisma/client';
import { prisma } from '../prisma';

/**
 * Access check engine.
 * Access checks read ONLY the Entitlement table (and chapter hierarchy to resolve subject and class).
 *
 * Rules:
 * - True if chapter is free (and user is signed in)
 * - True if user has an unrevoked CHAPTER entitlement for it
 * - True if user has an unrevoked SUBJECT entitlement for its subject
 * - True if user has an unrevoked CLASS_PASS entitlement for its class with expiresAt in the future
 */
export async function hasAccess(userId: string, chapterId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }

  // 1. Resolve chapter details (isFree, subjectId, classId)
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      subject: {
        select: {
          id: true,
          classId: true,
        },
      },
    },
  });

  if (!chapter) {
    return false;
  }

  // Free chapters are accessible to any signed-in user
  if (chapter.isFree) {
    return true;
  }

  const subjectId = chapter.subject.id;
  const classId = chapter.subject.classId;
  const now = new Date();

  // 2. Query ONLY the Entitlement table for active, unrevoked entitlements
  const activeEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      AND: [
        {
          OR: [
            {
              scope: EntitlementScope.CHAPTER,
              refId: chapter.id,
            },
            {
              scope: EntitlementScope.SUBJECT,
              refId: subjectId,
            },
            {
              scope: EntitlementScope.CLASS_PASS,
              refId: classId,
            },
          ],
        },
      ],
    },
  });

  return activeEntitlement !== null;
}
