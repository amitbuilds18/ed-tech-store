import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { hasAccess } from '../services/access';

const router = Router();

// Helper to safely get parameter as string
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || '';
}

// -------------------------------------------------------------
// GET /materials/:id/file - Stream PDF material if user has access
// Never exposes the internal file path to the client.
// -------------------------------------------------------------
router.get('/:id/file', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const materialId = getParam(req.params.id);
  const userId = req.user!.id;

  // 1. Fetch material record
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      title: true,
      filePath: true,
      chapterId: true,
    },
  });

  if (!material) {
    res.status(404).json({ error: 'Material not found' });
    return;
  }

  // 2. Perform access control check via hasAccess()
  const allowed = await hasAccess(userId, material.chapterId);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this material' });
    return;
  }

  // 3. Resolve file stream without exposing the server file path
  const sanitizedTitle = material.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${sanitizedTitle}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  const fullPath = path.resolve(process.cwd(), material.filePath);

  if (fs.existsSync(fullPath)) {
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } else {
    // Fallback for seed mock data: stream valid PDF bytes directly
    const mockPdfBuffer = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Title (${material.title}) >>\nendobj\ntrailer\n<<>>\n%%EOF`
    );
    res.send(mockPdfBuffer);
  }
});

export default router;
