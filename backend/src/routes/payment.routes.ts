import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma';
import { validateBody } from '../middleware/validate';
import { settleOrder } from '../services/settleOrder';

const router = Router();
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
});

// -------------------------------------------------------------
// POST /payments/verify - Verify HMAC-SHA256 signature and settle order
// -------------------------------------------------------------
router.post(
  '/verify',
  validateBody(verifyPaymentSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // 1. Find order by razorpayOrderId
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // 2. Verify HMAC-SHA256 of `${razorpayOrderId}|${razorpayPaymentId}` with key secret using crypto.timingSafeEqual
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(razorpaySignature, 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }

    // 3. Call settleOrder within transaction
    const result = await settleOrder(order.id, {
      razorpayPaymentId,
      razorpaySignature,
      amountPaise: order.amountPaise,
      status: 'captured',
    });

    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to settle order' });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.alreadyPaid ? 'Order already settled' : 'Payment verified and order settled successfully',
      orderId: order.id,
    });
  }
);

export default router;
