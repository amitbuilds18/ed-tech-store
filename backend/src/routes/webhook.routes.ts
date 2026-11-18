import { Router, Request, Response, raw } from 'express';
import crypto from 'crypto';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { settleOrder } from '../services/settleOrder';

const router = Router();
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret';

// -------------------------------------------------------------
// POST /webhooks/razorpay - Razorpay Webhook with raw body parsing
// express.raw() is used on this route ONLY.
// -------------------------------------------------------------
router.post(
  '/razorpay',
  raw({ type: '*/*' }),
  async (req: Request, res: Response): Promise<void> => {
    const signature = (req.headers['x-razorpay-signature'] ||
      req.headers['X-Razorpay-Signature']) as string;

    if (!signature) {
      res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
      return;
    }

    const rawBody = req.body; // Buffer from express.raw()
    if (!Buffer.isBuffer(rawBody)) {
      res.status(400).json({ error: 'Expected raw body buffer' });
      return;
    }

    // 1. Verify X-Razorpay-Signature against raw body with webhook secret
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret';
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    // 2. Parse payload from verified raw buffer
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'Malformed JSON payload' });
      return;
    }

    // Extract event ID
    const eventId =
      payload.event_id ||
      payload.id ||
      (req.headers['x-razorpay-event-id'] as string) ||
      `evt_${payload.event}_${payload.payload?.payment?.entity?.id || Date.now()}`;

    // 3. Store event in WebhookEvent table (unique eventId, ignore duplicates)
    try {
      await prisma.webhookEvent.create({
        data: {
          eventId,
          payload,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
        // Idempotency: duplicate webhook event received, ignore cleanly
        res.status(200).json({ status: 'ignored_duplicate', eventId });
        return;
      }
      console.error('Failed to log WebhookEvent:', err);
    }

    // 4. Handle event types
    const eventType = payload.event;
    const paymentEntity =
      payload.payload?.payment?.entity || payload.payment?.entity || payload.payment;

    if (eventType === 'payment.captured' && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const amountPaise = paymentEntity.amount;

      if (razorpayOrderId) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId },
        });

        if (order) {
          const settleRes = await settleOrder(order.id, {
            razorpayPaymentId,
            amountPaise,
            status: 'captured',
          });

          if (!settleRes.success) {
            // If amount mismatch, order remains unsettled and no entitlements are granted
            console.warn(`Webhook settlement error for order ${order.id}:`, settleRes.error);
          }
        }
      }
    } else if (eventType === 'payment.failed' && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id;

      if (razorpayOrderId) {
        // Mark order failed, grant nothing
        await prisma.order.updateMany({
          where: {
            razorpayOrderId,
            status: OrderStatus.CREATED,
          },
          data: { status: OrderStatus.FAILED },
        });
      }
    }

    res.status(200).json({ status: 'processed', eventId });
  }
);

export default router;
