import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import { AddressInfo } from 'net';
import { app } from '../app';
import { prisma } from '../prisma';
import { OrderStatus, ProductType, EntitlementScope } from '@prisma/client';
import { settleOrder } from './settleOrder';

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret';

describe('Payment Verification, Webhooks & SettleOrder', () => {
  let server: http.Server;
  let baseUrl: string;
  let testUser: { id: string; email: string };
  let chapterProduct: { id: string; targetId: string; pricePaise: number };
  let monthlyPassProduct: { id: string; targetId: string; pricePaise: number };

  beforeAll(async () => {
    // 1. Start server on ephemeral port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 2. Setup test user
    const testEmail = `test_settle_${Date.now()}@test.com`;
    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'dummy_hashed_password',
        role: 'STUDENT',
      },
    });

    // 3. Find sample products from seed
    const chapProd = await prisma.product.findFirst({
      where: { type: ProductType.CHAPTER, active: true },
    });
    if (!chapProd) throw new Error('No chapter product found in database');
    chapterProduct = chapProd;

    const passProd = await prisma.product.findFirst({
      where: { type: ProductType.MONTHLY_PASS, active: true },
    });
    if (!passProd) throw new Error('No monthly pass product found in database');
    monthlyPassProduct = passProd;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      await prisma.entitlement.deleteMany({ where: { userId: testUser.id } });
      const orders = await prisma.order.findMany({ where: { userId: testUser.id } });
      const orderIds = orders.map((o) => o.id);
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }

    await prisma.webhookEvent.deleteMany({
      where: { eventId: { startsWith: 'test_evt_' } },
    });

    if (server) {
      server.close();
    }
  });

  it('valid signature passes: POST /payments/verify verifies HMAC and marks order PAID', async () => {
    // Create an order in DB
    const rzpOrderId = `order_verify_${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        userId: testUser.id,
        amountPaise: chapterProduct.pricePaise,
        status: OrderStatus.CREATED,
        razorpayOrderId: rzpOrderId,
        items: {
          create: {
            productId: chapterProduct.id,
            pricePaise: chapterProduct.pricePaise,
          },
        },
      },
    });

    const rzpPaymentId = `pay_verify_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    const res = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: validSignature,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify database state: order is PAID, payment is recorded, entitlement is granted
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe(OrderStatus.PAID);

    const payment = await prisma.payment.findUnique({
      where: { razorpayPaymentId: rzpPaymentId },
    });
    expect(payment).toBeDefined();
    expect(payment?.amountPaise).toBe(chapterProduct.pricePaise);

    const entitlement = await prisma.entitlement.findFirst({
      where: {
        userId: testUser.id,
        scope: EntitlementScope.CHAPTER,
        refId: chapterProduct.targetId,
      },
    });
    expect(entitlement).toBeDefined();
    expect(entitlement?.expiresAt).toBeNull(); // Chapter has lifetime access
  });

  it('tampered signature fails: POST /payments/verify rejects forged signature', async () => {
    const rzpOrderId = `order_tamper_${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        userId: testUser.id,
        amountPaise: 50000,
        status: OrderStatus.CREATED,
        razorpayOrderId: rzpOrderId,
      },
    });

    const res = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: 'pay_fake_123',
        razorpaySignature: 'tampered_signature_hex_value_1234567890abcdef1234567890abcdef',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid payment signature');

    // Verify order was NOT paid and no payment was saved
    const unchangedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchangedOrder?.status).toBe(OrderStatus.CREATED);
  });

  it('tampered signature fails: POST /webhooks/razorpay rejects forged webhook signature', async () => {
    const bodyStr = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_tamper', order_id: 'order_tamper', amount: 1000 } } },
    });

    const res = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': 'bogus_signature_that_should_fail_verification_completely',
      },
      body: bodyStr,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid webhook signature');
  });

  it('same webhook sent twice grants once: deduplicates via WebhookEvent and row lock', async () => {
    const rzpOrderId = `order_dup_${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        userId: testUser.id,
        amountPaise: chapterProduct.pricePaise,
        status: OrderStatus.CREATED,
        razorpayOrderId: rzpOrderId,
        items: {
          create: {
            productId: chapterProduct.id,
            pricePaise: chapterProduct.pricePaise,
          },
        },
      },
    });

    const eventId = `test_evt_dup_${Date.now()}`;
    const rzpPaymentId = `pay_dup_${Date.now()}`;
    const payload = {
      event: 'payment.captured',
      event_id: eventId,
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId,
            order_id: rzpOrderId,
            amount: chapterProduct.pricePaise,
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // 1st webhook delivery
    const res1 = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validSignature,
      },
      body: rawBody,
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.status).toBe('processed');

    // Count entitlements for this order
    const countAfterFirst = await prisma.entitlement.count({
      where: { sourceOrderId: order.id },
    });
    expect(countAfterFirst).toBe(1);

    // 2nd webhook delivery with identical eventId
    const res2 = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validSignature,
      },
      body: rawBody,
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.status).toBe('ignored_duplicate');

    // Entitlement count must still be exactly 1!
    const countAfterSecond = await prisma.entitlement.count({
      where: { sourceOrderId: order.id },
    });
    expect(countAfterSecond).toBe(1);
  });

  it('wrong amount grants nothing: settleOrder fails if amount does not match', async () => {
    const rzpOrderId = `order_wrong_amt_${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        userId: testUser.id,
        amountPaise: 50000, // Expected 500 INR
        status: OrderStatus.CREATED,
        razorpayOrderId: rzpOrderId,
        items: {
          create: {
            productId: chapterProduct.id,
            pricePaise: 50000,
          },
        },
      },
    });

    const eventId = `test_evt_wrong_${Date.now()}`;
    const payload = {
      event: 'payment.captured',
      event_id: eventId,
      payload: {
        payment: {
          entity: {
            id: `pay_underpaid_${Date.now()}`,
            order_id: rzpOrderId,
            amount: 25000, // Underpaid! Only 250 INR
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const res = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validSignature,
      },
      body: rawBody,
    });
    expect(res.status).toBe(200);

    // Order must NOT be marked PAID
    const orderInDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderInDb?.status).toBe(OrderStatus.CREATED);

    // Entitlement must NOT be granted
    const entitlements = await prisma.entitlement.findMany({
      where: { sourceOrderId: order.id },
    });
    expect(entitlements.length).toBe(0);
  });

  it('pass extension: newExpiry = max(now, existingExpiry) + 30 days', async () => {
    // 1st Pass purchase
    const order1 = await prisma.order.create({
      data: {
        userId: testUser.id,
        amountPaise: monthlyPassProduct.pricePaise,
        status: OrderStatus.CREATED,
        razorpayOrderId: `order_pass_1_${Date.now()}`,
        items: {
          create: {
            productId: monthlyPassProduct.id,
            pricePaise: monthlyPassProduct.pricePaise,
          },
        },
      },
    });

    const res1 = await settleOrder(order1.id, {
      razorpayPaymentId: `pay_pass_1_${Date.now()}`,
      amountPaise: monthlyPassProduct.pricePaise,
      status: 'captured',
    });
    expect(res1.success).toBe(true);

    const firstEntitlement = await prisma.entitlement.findFirst({
      where: {
        userId: testUser.id,
        scope: EntitlementScope.CLASS_PASS,
        refId: monthlyPassProduct.targetId,
      },
    });
    expect(firstEntitlement).toBeDefined();
    expect(firstEntitlement?.expiresAt).toBeDefined();

    const firstExpiry = firstEntitlement!.expiresAt!.getTime();
    const approx30DaysMs = 30 * 24 * 60 * 60 * 1000;
    // Should be approximately now + 30 days
    expect(firstExpiry).toBeGreaterThan(Date.now() + approx30DaysMs - 10000);

    // 2nd Pass purchase for the exact same class
    const order2 = await prisma.order.create({
      data: {
        userId: testUser.id,
        amountPaise: monthlyPassProduct.pricePaise,
        status: OrderStatus.CREATED,
        razorpayOrderId: `order_pass_2_${Date.now()}`,
        items: {
          create: {
            productId: monthlyPassProduct.id,
            pricePaise: monthlyPassProduct.pricePaise,
          },
        },
      },
    });

    const res2 = await settleOrder(order2.id, {
      razorpayPaymentId: `pay_pass_2_${Date.now()}`,
      amountPaise: monthlyPassProduct.pricePaise,
      status: 'captured',
    });
    expect(res2.success).toBe(true);

    // Fetch the updated pass entitlement
    const extendedEntitlement = await prisma.entitlement.findUnique({
      where: { id: firstEntitlement!.id },
    });
    expect(extendedEntitlement).toBeDefined();
    const secondExpiry = extendedEntitlement!.expiresAt!.getTime();

    // Verify it extended from existingExpiry by 30 days:
    // secondExpiry should equal firstExpiry + 30 days (+/- a few ms)
    const diffMs = secondExpiry - firstExpiry;
    expect(Math.abs(diffMs - approx30DaysMs)).toBeLessThan(1000);
  });
});
