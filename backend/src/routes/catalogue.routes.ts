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
        include: {
          chapters: {
            include: {
              materials: { select: { id: true, title: true } },
            },
            orderBy: { order: 'asc' },
          },
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

  // Collect all subject IDs and chapter IDs in this class
  const subjectIds = classItem.subjects.map((s) => s.id);
  const chapterIds = classItem.subjects.flatMap((s) => s.chapters.map((c) => c.id));

  // Fetch subject pack and chapter products
  const [subjectPackProducts, chapterProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        targetId: { in: subjectIds },
        type: ProductType.SUBJECT_PACK,
        active: true,
      },
    }),
    prisma.product.findMany({
      where: {
        targetId: { in: chapterIds },
        type: ProductType.CHAPTER,
        active: true,
      },
    }),
  ]);

  const resolvedSubjects = classItem.subjects.map((subject) => {
    const subjectPackProd = subjectPackProducts.find((p) => p.targetId === subject.id);
    const subjChapterIds = subject.chapters.map((c) => c.id);

    let resolvedSubjectProduct = null;
    if (subjectPackProd) {
      resolvedSubjectProduct = EntitlementService.resolveProductState(
        entitlements,
        subjectPackProd,
        {
          subjectClassId: classId,
          subjectChapterIds: subjChapterIds,
        }
      );
    }

    const resolvedChapters = subject.chapters.map((ch) => {
      const access = EntitlementService.resolveChapterAccess(entitlements, ch, classId);
      const isCoveredByPackOrPass =
        access.ownedThrough === 'SUBJECT_PACK' || access.ownedThrough === 'CLASS_PASS';
      const isOffered = !ch.isFree && !isCoveredByPackOrPass && access.state !== 'OWNED';

      const chProduct = chapterProducts.find((p) => p.targetId === ch.id);
      let resolvedChapterProduct = null;
      if (chProduct) {
        resolvedChapterProduct = {
          ...EntitlementService.resolveProductState(entitlements, chProduct, {
            chapterSubjectId: subject.id,
            chapterClassId: classId,
          }),
          isOffered,
        };
      }

      return {
        id: ch.id,
        title: ch.name,
        name: ch.name,
        orderIndex: ch.order,
        order: ch.order,
        isFree: ch.isFree,
        state: access.state,
        ownedThrough: access.ownedThrough,
        isOffered,
        materials: ch.materials,
        product: resolvedChapterProduct,
      };
    });

    return {
      id: subject.id,
      name: subject.name,
      chapterCount: subject.chapters.length,
      product: resolvedSubjectProduct,
      state: resolvedSubjectProduct?.state || 'BUY',
      chapters: resolvedChapters,
    };
  });

  res.status(200).json({
    class: {
      id: classItem.id,
      name: classItem.name,
      board: classItem.board,
      subjects: resolvedSubjects,
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

    // Rule: Do not offer a chapter if the user owns its subject pack or has an active class pass
    const isCoveredByPackOrPass = access.ownedThrough === 'SUBJECT_PACK' || access.ownedThrough === 'CLASS_PASS';
    const isOffered = !ch.isFree && !isCoveredByPackOrPass && access.state !== 'OWNED';

    return {
      id: ch.id,
      name: ch.name,
      order: ch.order,
      isFree: ch.isFree,
      state: access.state,
      ownedThrough: access.ownedThrough,
      isOffered,
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

  // Rule: Do not offer a chapter if the user owns its subject pack or has an active class pass
  const isCoveredByPackOrPass = access.ownedThrough === 'SUBJECT_PACK' || access.ownedThrough === 'CLASS_PASS';
  const isOffered = !chapter.isFree && !isCoveredByPackOrPass && access.state !== 'OWNED';

  // Standalone product is offered ONLY if chapter is not free, not already owned, and not covered by a pack/pass
  const offeredProduct = isOffered ? resolvedProduct : null;

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
      isOffered,
      product: offeredProduct,
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

// -------------------------------------------------------------
// GET /api/catalogue/products/:productId - Public product detail with resolved state
// -------------------------------------------------------------
router.get('/products/:productId', async (req: Request, res: Response): Promise<void> => {
  const productId = getParam(req.params.productId);
  const entitlements = await getActiveEntitlements(req);

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.active) {
    res.status(404).json({ error: 'Product not found or inactive' });
    return;
  }

  let context: any = {};

  if (product.type === ProductType.CHAPTER) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: product.targetId },
      include: { subject: { select: { id: true, classId: true } } },
    });
    if (chapter) {
      context = {
        chapterSubjectId: chapter.subject.id,
        chapterClassId: chapter.subject.classId,
      };
    }
  } else if (product.type === ProductType.SUBJECT_PACK) {
    const subject = await prisma.subject.findUnique({
      where: { id: product.targetId },
      include: {
        class: { select: { id: true } },
        chapters: { select: { id: true } },
      },
    });
    if (subject) {
      context = {
        subjectClassId: subject.class.id,
        subjectChapterIds: subject.chapters.map((c) => c.id),
      };
    }
  }

  const resolved = EntitlementService.resolveProductState(entitlements, product, context);

  res.status(200).json({ product: resolved });
});

export default router;
