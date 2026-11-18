import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Protect all order routes with authentication
router.use(requireAuth);

// -------------------------------------------------------------
// GET /orders/:id - Poll order status and details
// -------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              type: true,
              targetId: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Authorization check: Only order owner or admin can view order status
  if (order.userId !== userId && userRole !== Role.ADMIN) {
    res.status(403).json({ error: 'Access denied: You do not have permission to view this order' });
    return;
  }

  res.status(200).json({
    id: order.id,
    status: order.status,
    amountPaise: order.amountPaise,
    razorpayOrderId: order.razorpayOrderId,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productTitle: item.product.title,
      productType: item.product.type,
      targetId: item.product.targetId,
      pricePaise: item.pricePaise,
    })),
  });
});

export default router;
