import { z } from 'zod';
import { ProductType } from '@prisma/client';

export const createProductSchema = z.object({
  title: z.string().trim().min(1, 'Product title is required'),
  type: z.nativeEnum(ProductType, {
    errorMap: () => ({ message: 'Product type must be CHAPTER, SUBJECT_PACK, MONTHLY_PASS, or ANNUAL_PASS' }),
  }),
  targetId: z.string().uuid('Valid targetId is required'),
  pricePaise: z.number().int().nonnegative('Price in paise must be a non-negative integer'),
  active: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  title: z.string().trim().min(1).optional(),
  pricePaise: z.number().int().nonnegative('Price in paise must be a non-negative integer').optional(),
  active: z.boolean().optional(),
});
