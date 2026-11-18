import { Router, Request, Response } from 'express';
import { EntitlementScope } from '@prisma/client';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// -------------------------------------------------------------
// GET /library - Return all owned items with expiry dates
// -------------------------------------------------------------
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const now = new Date();

  // Fetch all active, unrevoked entitlements for the user
  const entitlements = await prisma.entitlement.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const chapterIds = entitlements
    .filter((e) => e.scope === EntitlementScope.CHAPTER)
    .map((e) => e.refId);

  const subjectIds = entitlements
    .filter((e) => e.scope === EntitlementScope.SUBJECT)
    .map((e) => e.refId);

  const classIds = entitlements
    .filter((e) => e.scope === EntitlementScope.CLASS_PASS)
    .map((e) => e.refId);

  // Fetch full details of owned entities
  const [chapters, subjects, classes] = await Promise.all([
    prisma.chapter.findMany({
      where: { id: { in: chapterIds } },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true } },
          },
        },
        materials: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      include: {
        class: { select: { id: true, name: true, board: { select: { name: true } } } },
        chapters: {
          select: { id: true, name: true, isFree: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.class.findMany({
      where: { id: { in: classIds } },
      include: {
        board: { select: { id: true, name: true } },
        subjects: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  // Map entitlements with expiry metadata
  const mappedChapters = chapters.map((ch) => {
    const ent = entitlements.find((e) => e.scope === EntitlementScope.CHAPTER && e.refId === ch.id);
    return {
      id: ch.id,
      name: ch.name,
      order: ch.order,
      subject: ch.subject,
      materials: ch.materials,
      expiresAt: ent?.expiresAt || null, // null for lifetime
      isLifetime: true,
    };
  });

  const mappedSubjects = subjects.map((subj) => {
    const ent = entitlements.find((e) => e.scope === EntitlementScope.SUBJECT && e.refId === subj.id);
    return {
      id: subj.id,
      name: subj.name,
      class: subj.class,
      chaptersCount: subj.chapters.length,
      chapters: subj.chapters,
      expiresAt: ent?.expiresAt || null, // null for lifetime
      isLifetime: true,
    };
  });

  const mappedPasses = classes.map((cls) => {
    const ent = entitlements.find((e) => e.scope === EntitlementScope.CLASS_PASS && e.refId === cls.id);
    return {
      classId: cls.id,
      className: cls.name,
      boardName: cls.board.name,
      subjectsCount: cls.subjects.length,
      expiresAt: ent?.expiresAt || null,
      isLifetime: false,
    };
  });

  res.status(200).json({
    library: {
      chapters: mappedChapters,
      subjects: mappedSubjects,
      passes: mappedPasses,
      totalActiveEntitlements: entitlements.length,
    },
  });
});

export default router;
