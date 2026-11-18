import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Role, ProductType } from '@prisma/client';
import { prisma } from '../prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { uploadPdf } from '../middleware/upload';
import {
  createBoardSchema,
  updateBoardSchema,
  createClassSchema,
  updateClassSchema,
  createSubjectSchema,
  updateSubjectSchema,
  createChapterSchema,
  updateChapterSchema,
} from '../schemas/catalogue.schema';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';

const router = Router();

// Helper to safely get route parameter as string
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || '';
}

// Guard all admin routes with requireAuth and requireRole('ADMIN')
router.use(requireAuth, requireRole(Role.ADMIN));

// =============================================================
// BOARDS CRUD
// =============================================================

// GET /api/admin/boards - List all boards
router.get('/boards', async (_req: Request, res: Response): Promise<void> => {
  const boards = await prisma.board.findMany({
    include: {
      classes: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ boards });
});

// GET /api/admin/boards/:id - Get single board
router.get('/boards/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      classes: {
        include: { subjects: true },
      },
    },
  });

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  res.status(200).json({ board });
});

// POST /api/admin/boards - Create a board
router.post('/boards', validateBody(createBoardSchema), async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body;

  const existing = await prisma.board.findUnique({
    where: { name },
  });
  if (existing) {
    res.status(400).json({ error: 'A board with this name already exists' });
    return;
  }

  const board = await prisma.board.create({
    data: { name },
  });
  res.status(201).json({ message: 'Board created successfully', board });
});

// PUT /api/admin/boards/:id - Update a board
router.put('/boards/:id', validateBody(updateBoardSchema), async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const { name } = req.body;

  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  const updated = await prisma.board.update({
    where: { id },
    data: { name },
  });
  res.status(200).json({ message: 'Board updated successfully', board: updated });
});

// DELETE /api/admin/boards/:id - Delete a board
router.delete('/boards/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  await prisma.board.delete({ where: { id } });
  res.status(200).json({ message: 'Board deleted successfully' });
});

// =============================================================
// CLASSES CRUD
// =============================================================

// GET /api/admin/classes - List all classes
router.get('/classes', async (_req: Request, res: Response): Promise<void> => {
  const classes = await prisma.class.findMany({
    include: {
      board: { select: { id: true, name: true } },
      subjects: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ classes });
});

// GET /api/admin/classes/:id - Get single class
router.get('/classes/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const classItem = await prisma.class.findUnique({
    where: { id },
    include: {
      board: true,
      subjects: {
        include: { chapters: true },
      },
    },
  });

  if (!classItem) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }

  res.status(200).json({ class: classItem });
});

// POST /api/admin/classes - Create class under a board
router.post('/classes', validateBody(createClassSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, boardId } = req.body;

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  const classItem = await prisma.class.create({
    data: { name, boardId },
  });
  res.status(201).json({ message: 'Class created successfully', class: classItem });
});

// PUT /api/admin/classes/:id - Update a class
router.put('/classes/:id', validateBody(updateClassSchema), async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const { name, boardId } = req.body;

  const classItem = await prisma.class.findUnique({ where: { id } });
  if (!classItem) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }

  if (boardId) {
    const boardExists = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardExists) {
      res.status(404).json({ error: 'Referenced board does not exist' });
      return;
    }
  }

  const updated = await prisma.class.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(boardId && { boardId }),
    },
  });
  res.status(200).json({ message: 'Class updated successfully', class: updated });
});

// DELETE /api/admin/classes/:id - Delete a class
router.delete('/classes/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const classItem = await prisma.class.findUnique({ where: { id } });
  if (!classItem) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }

  await prisma.class.delete({ where: { id } });
  res.status(200).json({ message: 'Class deleted successfully' });
});

// =============================================================
// SUBJECTS CRUD
// =============================================================

// GET /api/admin/subjects - List all subjects
router.get('/subjects', async (_req: Request, res: Response): Promise<void> => {
  const subjects = await prisma.subject.findMany({
    include: {
      class: {
        select: { id: true, name: true, board: { select: { name: true } } },
      },
      chapters: { select: { id: true, name: true, isFree: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ subjects });
});

// GET /api/admin/subjects/:id - Get single subject
router.get('/subjects/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      class: { include: { board: true } },
      chapters: { include: { materials: true } },
    },
  });

  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  res.status(200).json({ subject });
});

// POST /api/admin/subjects - Create a subject under a class
router.post('/subjects', validateBody(createSubjectSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, classId } = req.body;

  const classExists = await prisma.class.findUnique({ where: { id: classId } });
  if (!classExists) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }

  const subject = await prisma.subject.create({
    data: { name, classId },
  });
  res.status(201).json({ message: 'Subject created successfully', subject });
});

// PUT /api/admin/subjects/:id - Update a subject
router.put('/subjects/:id', validateBody(updateSubjectSchema), async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const { name, classId } = req.body;

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  if (classId) {
    const classExists = await prisma.class.findUnique({ where: { id: classId } });
    if (!classExists) {
      res.status(404).json({ error: 'Referenced class does not exist' });
      return;
    }
  }

  const updated = await prisma.subject.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(classId && { classId }),
    },
  });
  res.status(200).json({ message: 'Subject updated successfully', subject: updated });
});

// DELETE /api/admin/subjects/:id - Delete a subject
router.delete('/subjects/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  await prisma.subject.delete({ where: { id } });
  res.status(200).json({ message: 'Subject deleted successfully' });
});

// =============================================================
// CHAPTERS CRUD & FREE STATUS TOGGLE
// =============================================================

// GET /api/admin/chapters - List all chapters
router.get('/chapters', async (_req: Request, res: Response): Promise<void> => {
  const chapters = await prisma.chapter.findMany({
    include: {
      subject: { select: { id: true, name: true, class: { select: { name: true } } } },
      materials: true,
    },
    orderBy: [{ subjectId: 'asc' }, { order: 'asc' }],
  });
  res.status(200).json({ chapters });
});

// GET /api/admin/chapters/:id - Get single chapter
router.get('/chapters/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      subject: { include: { class: true } },
      materials: true,
    },
  });

  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  res.status(200).json({ chapter });
});

// POST /api/admin/chapters - Create a chapter under a subject
router.post('/chapters', validateBody(createChapterSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, subjectId, order, isFree } = req.body;

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const chapter = await prisma.chapter.create({
    data: {
      name,
      subjectId,
      order: order ?? 1,
      isFree: isFree ?? false,
    },
  });
  res.status(201).json({ message: 'Chapter created successfully', chapter });
});

// PUT /api/admin/chapters/:id - Update chapter details
router.put('/chapters/:id', validateBody(updateChapterSchema), async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const { name, order, isFree } = req.body;

  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  const updated = await prisma.chapter.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(order !== undefined && { order }),
      ...(isFree !== undefined && { isFree }),
    },
  });
  res.status(200).json({ message: 'Chapter updated successfully', chapter: updated });
});

// PATCH /api/admin/chapters/:id/toggle-free - Toggle chapter isFree boolean
router.patch('/chapters/:id/toggle-free', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  const updated = await prisma.chapter.update({
    where: { id },
    data: {
      isFree: !chapter.isFree,
    },
  });

  res.status(200).json({
    message: `Chapter is now marked as ${updated.isFree ? 'FREE' : 'PAID'}`,
    chapter: updated,
  });
});

// DELETE /api/admin/chapters/:id - Delete a chapter
router.delete('/chapters/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  await prisma.chapter.delete({ where: { id } });
  res.status(200).json({ message: 'Chapter deleted successfully' });
});

// =============================================================
// CHAPTER PDF MATERIAL UPLOAD (MULTER)
// =============================================================

// POST /api/admin/chapters/:chapterId/materials - Upload a PDF material to a chapter
router.post(
  '/chapters/:chapterId/materials',
  uploadPdf('file'),
  async (req: Request, res: Response): Promise<void> => {
    const chapterId = getParam(req.params.chapterId);
    const { title } = req.body;

    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) {
      // Clean up uploaded file if chapter does not exist
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }

    // Relative path for database storage (e.g. uploads/17424...pdf)
    const relativePath = path.relative(path.resolve(__dirname, '../../'), req.file!.path).replace(/\\/g, '/');

    const material = await prisma.material.create({
      data: {
        title: title || req.file!.originalname,
        filePath: relativePath,
        chapterId,
      },
    });

    res.status(201).json({
      message: 'PDF material uploaded successfully',
      material,
    });
  }
);

// DELETE /api/admin/materials/:id - Delete a material and its file
router.delete('/materials/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) {
    res.status(404).json({ error: 'Material not found' });
    return;
  }

  // Remove file from disk if it exists
  const fullFilePath = path.resolve(process.cwd(), material.filePath);
  if (fs.existsSync(fullFilePath)) {
    try {
      fs.unlinkSync(fullFilePath);
    } catch (e) {
      console.warn(`Could not delete file at ${fullFilePath}`, e);
    }
  }

  await prisma.material.delete({ where: { id } });
  res.status(200).json({ message: 'Material deleted successfully' });
});

// =============================================================
// PRODUCTS CRUD & PRICING MANAGEMENT
// =============================================================

// GET /api/admin/products - List all products with optional filters
router.get('/products', async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as ProductType | undefined;
  const targetId = req.query.targetId as string | undefined;
  const activeStr = req.query.active as string | undefined;

  const where: any = {};
  if (type) where.type = type;
  if (targetId) where.targetId = targetId;
  if (activeStr !== undefined) where.active = activeStr === 'true';

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ products });
});

// GET /api/admin/products/:id - Get single product
router.get('/products/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.status(200).json({ product });
});

// POST /api/admin/products - Create a new product
router.post('/products', validateBody(createProductSchema), async (req: Request, res: Response): Promise<void> => {
  const { title, type, targetId, pricePaise, active } = req.body;

  // Validate targetId references an existing entity based on product type
  if (type === ProductType.CHAPTER) {
    const chapterExists = await prisma.chapter.findUnique({ where: { id: targetId } });
    if (!chapterExists) {
      res.status(404).json({ error: 'Referenced Chapter does not exist' });
      return;
    }
  } else if (type === ProductType.SUBJECT_PACK) {
    const subjectExists = await prisma.subject.findUnique({ where: { id: targetId } });
    if (!subjectExists) {
      res.status(404).json({ error: 'Referenced Subject does not exist' });
      return;
    }
  } else if (type === ProductType.MONTHLY_PASS || type === ProductType.ANNUAL_PASS) {
    const classExists = await prisma.class.findUnique({ where: { id: targetId } });
    if (!classExists) {
      res.status(404).json({ error: 'Referenced Class does not exist' });
      return;
    }
  }

  const product = await prisma.product.create({
    data: {
      title,
      type,
      targetId,
      pricePaise,
      active: active !== undefined ? active : true,
    },
  });

  res.status(201).json({
    message: 'Product created successfully',
    product,
  });
});

// PUT /api/admin/products/:id - Update product title, price, or active status
router.put('/products/:id', validateBody(updateProductSchema), async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);
  const { title, pricePaise, active } = req.body;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(pricePaise !== undefined && { pricePaise }),
      ...(active !== undefined && { active }),
    },
  });

  res.status(200).json({
    message: 'Product updated successfully',
    product: updated,
  });
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', async (req: Request, res: Response): Promise<void> => {
  const id = getParam(req.params.id);

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  await prisma.product.delete({ where: { id } });
  res.status(200).json({ message: 'Product deleted successfully' });
});

export default router;

