import { Router, Request, Response } from 'express';
import { ProductType } from '@prisma/client';
import { prisma } from '../prisma';
import { optionalAuth } from '../middleware/auth';
import { EntitlementService, EntitlementWithOrder } from '../services/entitlement.service';

const router = Router();

// Apply optionalAuth so logged-in students receive personalized entitlement states
router.use(optionalAuth);

// Helper to safely get parameter as string
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || '';
}

// Helper to fetch user entitlements if logged in
async function getActiveEntitlements(req: Request): Promise<EntitlementWithOrder[]> {
  if (!req.user || !req.user.id) {
    return [];
  }
  return EntitlementService.getUserActiveEntitlements(req.user.id);
}

// -------------------------------------------------------------
// GET /api/catalogue/boards - List all boards
// -------------------------------------------------------------
router.get('/boards', async (_req: Request, res: Response): Promise<void> => {
  const boards = await prisma.board.findMany({
    select: {
      id: true,
      name: true,
      classes: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = boards.map((b) => ({
    id: b.id,
    name: b.name,
    classCount: b.classes.length,
    classes: b.classes,
  }));

  res.status(200).json({ boards: formatted });
});

// -------------------------------------------------------------
// GET /api/catalogue/boards/:boardId - Board details with classes
// -------------------------------------------------------------
router.get('/boards/:boardId', async (req: Request, res: Response): Promise<void> => {
  const boardId = getParam(req.params.boardId);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      classes: {
        include: {
          subjects: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  res.status(200).json({ board });
});

// -------------------------------------------------------------
// GET /api/catalogue/classes/:classId - Class with subjects & passes
// -------------------------------------------------------------
router.get('/classes/:classId', async (req: Request, res: Response): Promise<void> => {
  const classId = getParam(req.params.classId);
  const entitlements = await getActiveEntitlements(req);

  const classItem = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      board: true,
      subjects: {
        select: {
          id: true,
          name: true,
          _count: { select: { chapters: true } },
        },
      },
    },
  });

  if (!classItem) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }

  // Fetch Class Pass products (MONTHLY_PASS and ANNUAL_PASS)
  const passProducts = await prisma.product.findMany({
    where: {
      targetId: classId,
      type: { in: [ProductType.MONTHLY_PASS, ProductType.ANNUAL_PASS] },
      active: true,
    },
  });

  const resolvedPasses = passProducts.map((prod) =>
    EntitlementService.resolveProductState(entitlements, prod, {})
  );

  res.status(200).json({
    class: {
      id: classItem.id,
      name: classItem.name,
      board: classItem.board,
      subjects: classItem.subjects.map((s) => ({
        id: s.id,
        name: s.name,
        chapterCount: s._count.chapters,
      })),
      passes: resolvedPasses,
    },
  });
});

// -------------------------------------------------------------
// GET /api/catalogue/subjects/:subjectId - Subject with chapters & pack
// -------------------------------------------------------------
router.get('/subjects/:subjectId', async (req: Request, res: Response): Promise<void> => {
  const subjectId = getParam(req.params.subjectId);
  const entitlements = await getActiveEntitlements(req);

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      class: {
        include: { board: true },
      },
      chapters: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const classId = subject.class.id;
  const chapterIds = subject.chapters.map((ch) => ch.id);

  // 1. Resolve subject pack product state (OWNED, UPGRADE [with credit], BUY)
  const subjectPackProduct = await prisma.product.findFirst({
    where: {
      targetId: subjectId,
      type: ProductType.SUBJECT_PACK,
      active: true,
    },
  });

  let resolvedSubjectPack = null;
  if (subjectPackProduct) {
    resolvedSubjectPack = EntitlementService.resolveProductState(
      entitlements,
      subjectPackProduct,
      {
        subjectClassId: classId,
        subjectChapterIds: chapterIds,
      }
    );
  }

  // 2. Resolve each chapter's access state
  const chaptersWithState = subject.chapters.map((ch) => {
    const access = EntitlementService.resolveChapterAccess(
      entitlements,
      ch,
      classId
    );

    return {
      id: ch.id,
      name: ch.name,
      order: ch.order,
      isFree: ch.isFree,
      state: access.state,
      ownedThrough: access.ownedThrough,
      // If chapter is owned through subject pack or class pass, it must NOT be offered individually
      canPurchaseIndividually: access.state !== 'OWNED',
    };
  });

  res.status(200).json({
    subject: {
      id: subject.id,
      name: subject.name,
      class: subject.class,
      subjectPack: resolvedSubjectPack,
      chapters: chaptersWithState,
    },
  });
});

// -------------------------------------------------------------
// GET /api/catalogue/chapters/:chapterId - Chapter details & materials
// -------------------------------------------------------------
router.get('/chapters/:chapterId', async (req: Request, res: Response): Promise<void> => {
  const chapterId = getParam(req.params.chapterId);
  const entitlements = await getActiveEntitlements(req);

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      subject: {
        include: {
          class: { include: { board: true } },
        },
      },
      materials: true,
    },
  });

  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  const classId = chapter.subject.class.id;
  const subjectId = chapter.subject.id;

  // Compute chapter access state
  const access = EntitlementService.resolveChapterAccess(
    entitlements,
    chapter,
    classId
  );

  // Fetch chapter standalone product
  const chapterProduct = await prisma.product.findFirst({
    where: {
      targetId: chapterId,
      type: ProductType.CHAPTER,
      active: true,
    },
  });

  let resolvedProduct = null;
  if (chapterProduct) {
    resolvedProduct = EntitlementService.resolveProductState(
      entitlements,
      chapterProduct,
      {
        chapterClassId: classId,
        chapterSubjectId: subjectId,
      }
    );
  }

  // Materials are accessible ONLY if chapter is free or user has OWNED access
  const canAccessMaterials = chapter.isFree || access.state === 'OWNED';
  const deliveredMaterials = canAccessMaterials
    ? chapter.materials.map((m) => ({
        id: m.id,
        title: m.title,
        filePath: m.filePath,
      }))
    : [];

  res.status(200).json({
    chapter: {
      id: chapter.id,
      name: chapter.name,
      order: chapter.order,
      isFree: chapter.isFree,
      subject: chapter.subject,
      state: access.state,
      ownedThrough: access.ownedThrough,
      product: resolvedProduct,
      materials: deliveredMaterials,
      materialsLocked: !canAccessMaterials,
    },
  });
});

// -------------------------------------------------------------
// GET /api/catalogue/search?q=... - Global search by name
// -------------------------------------------------------------
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!query) {
    res.status(200).json({ results: { boards: [], classes: [], subjects: [], chapters: [] } });
    return;
  }

  const entitlements = await getActiveEntitlements(req);

  // Search across Boards, Classes, Subjects, and Chapters
  const [boards, classes, subjects, chapters] = await Promise.all([
    prisma.board.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: 10,
    }),
    prisma.class.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      include: { board: { select: { id: true, name: true } } },
      take: 10,
    }),
    prisma.subject.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      include: {
        class: {
          select: { id: true, name: true, board: { select: { id: true, name: true } } },
        },
      },
      take: 10,
    }),
    prisma.chapter.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      take: 20,
    }),
  ]);

  // Compute entitlement states for matched chapters
  const resolvedChapters = chapters.map((ch) => {
    const classId = ch.subject.class.id;
    const access = EntitlementService.resolveChapterAccess(
      entitlements,
      ch,
      classId
    );

    return {
      id: ch.id,
      name: ch.name,
      order: ch.order,
      isFree: ch.isFree,
      subject: ch.subject,
      state: access.state,
      ownedThrough: access.ownedThrough,
    };
  });

  res.status(200).json({
    query,
    results: {
      boards,
      classes,
      subjects,
      chapters: resolvedChapters,
    },
  });
});

export default router;
