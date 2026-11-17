import { PrismaClient } from '@prisma/client';

// Single Prisma Client instance shared across application
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
