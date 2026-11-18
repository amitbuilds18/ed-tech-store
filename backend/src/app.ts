import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Role } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import catalogueRoutes from './routes/catalogue.routes';
import { requireAuth, requireRole } from './middleware/auth';

export const app: Application = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
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

// Admin catalogue management & materials upload routes
app.use('/api/admin', adminRoutes);

// Student & Public catalogue browsing routes
app.use('/api/catalogue', catalogueRoutes);


// Admin dashboard route
app.get('/api/admin/dashboard', requireAuth, requireRole(Role.ADMIN), (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Admin Dashboard',
    admin: req.user,
  });
});


