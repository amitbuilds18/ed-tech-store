import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import { app } from '../app';
import { prisma } from '../prisma';
import { OrderStatus, Role, ProductType } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'edtech_super_secret_jwt_key_2026_secure!';

describe('Admin Orders & Printable Invoice Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminUser: { id: string; email: string };
  let studentUser: { id: string; email: string };
  let otherStudentUser: { id: string; email: string };
  let adminCookie: string;
  let studentCookie: string;
  let otherStudentCookie: string;
  let sampleOrder: any;

  beforeAll(async () => {
    // 1. Start ephemeral HTTP server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 2. Create test users
    const timestamp = Date.now();
    adminUser = await prisma.user.create({
      data: {
        email: `admin_orders_${timestamp}@test.com`,
        password: 'hashed_password',
        role: Role.ADMIN,
      },
    });

    studentUser = await prisma.user.create({
      data: {
        email: `student_orders_${timestamp}@test.com`,
        password: 'hashed_password',
        role: Role.STUDENT,
      },
    });

    otherStudentUser = await prisma.user.create({
      data: {
        email: `other_student_${timestamp}@test.com`,
        password: 'hashed_password',
        role: Role.STUDENT,
      },
    });

    // 3. Generate session JWT cookies
    const adminToken = jwt.sign({ id: adminUser.id, role: Role.ADMIN }, JWT_SECRET);
    const studentToken = jwt.sign({ id: studentUser.id, role: Role.STUDENT }, JWT_SECRET);
    const otherToken = jwt.sign({ id: otherStudentUser.id, role: Role.STUDENT }, JWT_SECRET);

    adminCookie = `token=${adminToken}`;
    studentCookie = `token=${studentToken}`;
    otherStudentCookie = `token=${otherToken}`;

    // 4. Create sample product and orders with varied statuses
    const product = await prisma.product.findFirst({
      where: { active: true },
    });
    const prodId = product ? product.id : 'sample-prod';

    // Order 1: PAID (amount: 59000 paise = 590 INR)
    sampleOrder = await prisma.order.create({
      data: {
        userId: studentUser.id,
        status: OrderStatus.PAID,
        amountPaise: 59000,
        razorpayOrderId: `rzp_inv_${timestamp}`,
        items: {
          create: {
            productId: prodId,
            pricePaise: 59000,
          },
        },
        payments: {
          create: {
            razorpayPaymentId: `pay_inv_${timestamp}`,
            amountPaise: 59000,
            status: 'captured',
          },
        },
      },
    });

    // Order 2: CREATED
    await prisma.order.create({
      data: {
        userId: studentUser.id,
        status: OrderStatus.CREATED,
        amountPaise: 29900,
        razorpayOrderId: `rzp_created_${timestamp}`,
        items: {
          create: {
            productId: prodId,
            pricePaise: 29900,
          },
        },
      },
    });

    // Order 3: FAILED
    await prisma.order.create({
      data: {
        userId: studentUser.id,
        status: OrderStatus.FAILED,
        amountPaise: 15000,
        razorpayOrderId: `rzp_failed_${timestamp}`,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test users and orders
    const userIds = [adminUser.id, studentUser.id, otherStudentUser.id];
    const orders = await prisma.order.findMany({ where: { userId: { in: userIds } } });
    const orderIds = orders.map((o) => o.id);

    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    if (server) {
      server.close();
    }
  });

  it('GET /admin/orders: requires authentication and ADMIN role (403 for student)', async () => {
    // 1. Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/orders`);
    expect(unauthRes.status).toBe(401);

    // 2. Student -> 403 Forbidden
    const studentRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: studentCookie },
    });
    expect(studentRes.status).toBe(403);
    const studentData = await studentRes.json();
    expect(studentData.error).toBe('Forbidden: Insufficient permissions');

    // 3. Admin -> 200 OK
    const adminRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: adminCookie },
    });
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();
    expect(Array.isArray(adminData.orders)).toBe(true);
    expect(adminData.orders.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /admin/orders: filters by status=PAID, status=CREATED, status=FAILED', async () => {
    // Filter PAID
    const paidRes = await fetch(`${baseUrl}/api/admin/orders?status=PAID`, {
      headers: { Cookie: adminCookie },
    });
    expect(paidRes.status).toBe(200);
    const paidData = await paidRes.json();
    expect(paidData.orders.every((o: any) => o.status === 'PAID')).toBe(true);

    // Filter CREATED
    const createdRes = await fetch(`${baseUrl}/api/admin/orders?status=CREATED`, {
      headers: { Cookie: adminCookie },
    });
    expect(createdRes.status).toBe(200);
    const createdData = await createdRes.json();
    expect(createdData.orders.every((o: any) => o.status === 'CREATED')).toBe(true);

    // Filter FAILED
    const failedRes = await fetch(`${baseUrl}/api/admin/orders?status=FAILED`, {
      headers: { Cookie: adminCookie },
    });
    expect(failedRes.status).toBe(200);
    const failedData = await failedRes.json();
    expect(failedData.orders.every((o: any) => o.status === 'FAILED')).toBe(true);
  });

  it('GET /admin/orders: filters by date range', async () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const res = await fetch(`${baseUrl}/api/admin/orders?startDate=${today}&endDate=${today}`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /orders/:id/invoice: computes correct 18% GST split and enforces ownership', async () => {
    // 1. Order owner (student) can access invoice
    const studentRes = await fetch(`${baseUrl}/api/orders/${sampleOrder.id}/invoice`, {
      headers: { Cookie: studentCookie },
    });
    expect(studentRes.status).toBe(200);
    const data = await studentRes.json();
    expect(data.invoice).toBeDefined();

    const tax = data.invoice.taxBreakdown;
    // Expected GST math for 59000 paise (590 INR):
    // Base = Math.round(59000 * 100 / 118) = 50000 paise (500 INR)
    // Total GST = 59000 - 50000 = 9000 paise (90 INR)
    // CGST (9%) = 4500 paise (45 INR)
    // SGST (9%) = 4500 paise (45 INR)
    expect(tax.totalPaise).toBe(59000);
    expect(tax.basePaise).toBe(50000);
    expect(tax.totalGstPaise).toBe(9000);
    expect(tax.cgstPaise).toBe(4500);
    expect(tax.sgstPaise).toBe(4500);
    expect(tax.basePaise + tax.totalGstPaise).toBe(tax.totalPaise);

    // 2. Admin can also access invoice
    const adminRes = await fetch(`${baseUrl}/api/orders/${sampleOrder.id}/invoice`, {
      headers: { Cookie: adminCookie },
    });
    expect(adminRes.status).toBe(200);

    // 3. Other student cannot access another user's invoice (403)
    const otherRes = await fetch(`${baseUrl}/api/orders/${sampleOrder.id}/invoice`, {
      headers: { Cookie: otherStudentCookie },
    });
    expect(otherRes.status).toBe(403);
  });
});
