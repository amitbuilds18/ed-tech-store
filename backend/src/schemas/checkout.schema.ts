import { z } from 'zod';

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Valid productId is required'),
        // Note: Any client-supplied price or amount is intentionally ignored and discarded
      })
    )
    .min(1, 'Cart must contain at least one item'),
  couponCode: z.string().trim().optional(),
});
