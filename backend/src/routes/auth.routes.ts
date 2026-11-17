import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { AuthUser } from '../types/express';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'edtech_super_secret_jwt_key_2026_secure!';

// Rate limiter for login: max 10 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

// Zod validation schemas
const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Helper function to sign JWT and attach httpOnly cookie
function setAuthCookie(res: Response, user: AuthUser): void {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
}

// -------------------------------------------------------------
// POST /api/auth/signup - Register a new student account
// -------------------------------------------------------------
router.post('/signup', validateBody(signupSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    res.status(400).json({ error: 'An account with this email already exists' });
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user (default role: STUDENT)
  const newUser = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || null,
      role: Role.STUDENT,
    },
  });

  const authUser: AuthUser = {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
  };

  // Set httpOnly cookie
  setAuthCookie(res, authUser);

  res.status(201).json({
    message: 'Account created successfully',
    user: authUser,
  });
});

// -------------------------------------------------------------
// POST /api/auth/login - Authenticate with email and password
// -------------------------------------------------------------
router.post('/login', loginLimiter, validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  // Set httpOnly cookie
  setAuthCookie(res, authUser);

  res.status(200).json({
    message: 'Logged in successfully',
    user: authUser,
  });
});

// -------------------------------------------------------------
// POST /api/auth/logout - Clear session cookie
// -------------------------------------------------------------
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

// -------------------------------------------------------------
// GET /api/auth/me - Return current authenticated user profile
// -------------------------------------------------------------
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Fetch fresh user record from database
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json({ user });
});

export default router;
