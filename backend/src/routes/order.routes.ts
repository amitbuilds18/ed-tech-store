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

// -------------------------------------------------------------
// GET /orders/:id/invoice - Return printable tax invoice data with GST split
// -------------------------------------------------------------
router.get('/:id/invoice', async (req: Request, res: Response): Promise<void> => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
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
      payments: {
        select: {
          id: true,
          razorpayPaymentId: true,
          amountPaise: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Authorization check: Only order owner or admin can view invoice
  if (order.userId !== userId && userRole !== Role.ADMIN) {
    res.status(403).json({ error: 'Access denied: You do not have permission to view this invoice' });
    return;
  }

  // Calculate 18% GST split:
  // Base = Math.round(Total * 100 / 118)
  // GST = Total - Base
  // CGST = Math.round(GST / 2), SGST = GST - CGST
  const totalPaise = order.amountPaise;
  const basePaise = Math.round((totalPaise * 100) / 118);
  const totalGstPaise = totalPaise - basePaise;
  const cgstPaise = Math.round(totalGstPaise / 2);
  const sgstPaise = totalGstPaise - cgstPaise;

  const invoiceData = {
    invoiceNumber: `INV-${order.id.slice(0, 8).toUpperCase()}`,
    invoiceDate: order.createdAt,
    order: {
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      amountPaise: order.amountPaise,
      razorpayOrderId: order.razorpayOrderId,
    },
    seller: {
      companyName: 'EdTech Academy Private Limited',
      address: '123 Tech Park, 4th Floor, Sector 5, Bengaluru, Karnataka, 560100',
      gstin: '29AABCU9603R1ZM',
      cin: 'U72200KA2024PTC188000',
      email: 'support@edtechacademy.com',
      state: 'Karnataka (State Code 29)',
    },
    buyer: {
      id: order.user.id,
      name: order.user.name || 'Valued Student',
      email: order.user.email,
    },
    payment: order.payments[0] || null,
    items: order.items.map((i) => {
      const itemTotal = i.pricePaise;
      const itemBase = Math.round((itemTotal * 100) / 118);
      const itemGst = itemTotal - itemBase;
      return {
        id: i.id,
        productId: i.productId,
        title: i.product.title,
        type: i.product.type,
        hsnSac: '999293', // Educational and online training services
        quantity: 1,
        totalPaise: itemTotal,
        basePaise: itemBase,
        gstPaise: itemGst,
      };
    }),
    taxBreakdown: {
      basePaise,
      cgstRate: 9,
      cgstPaise,
      sgstRate: 9,
      sgstPaise,
      totalGstRate: 18,
      totalGstPaise,
      totalPaise,
    },
  };

  res.status(200).json({ invoice: invoiceData });
});

export default router;
