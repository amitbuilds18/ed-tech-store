import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Role } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import catalogueRoutes from './routes/catalogue.routes';
import materialRoutes from './routes/material.routes';
import libraryRoutes from './routes/library.routes';
import checkoutRoutes from './routes/checkout.routes';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';
import orderRoutes from './routes/order.routes';
import { requireAuth, requireRole } from './middleware/auth';

export const app: Application = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());

// Webhook routes mounted BEFORE express.json() so express.raw() can capture raw body
app.use('/api/webhooks', webhookRoutes);
app.use('/webhooks', webhookRoutes);

app.use(express.json());

// Basic health check route
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'edtech-backend',
  });
});

// Authentication routes (signup, login, logout, me)
app.use('/api/auth', authRoutes);

// Admin catalogue management & materials upload routes (supports /admin and /api/admin)
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

// Student & Public catalogue browsing routes
app.use('/api/catalogue', catalogueRoutes);

// Material PDF streaming routes (supports /materials/:id/file and /api/materials/:id/file)
app.use('/api/materials', materialRoutes);
app.use('/materials', materialRoutes);

// Student library routes (supports /library and /api/library)
app.use('/api/library', libraryRoutes);
app.use('/library', libraryRoutes);

// Checkout and Razorpay order creation routes (supports /checkout and /api/checkout)
app.use('/api/checkout', checkoutRoutes);
app.use('/checkout', checkoutRoutes);

// Payment verification routes (supports /payments and /api/payments)
app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

// Order status polling routes (supports /orders and /api/orders)
app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);




// Admin dashboard route
app.get('/api/admin/dashboard', requireAuth, requireRole(Role.ADMIN), (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Admin Dashboard',
    admin: req.user,
  });
});


