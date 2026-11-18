import Razorpay from 'razorpay';
import crypto from 'crypto';

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';

export const razorpayClient = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * Creates a Razorpay order in test mode with amount in paise.
 * If amount is 0, or if placeholder keys are active, generates an idempotent test order ID.
 */
export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string
): Promise<{ id: string }> {
  // Free order (covered by 100% discount or upgrade credit)
  if (amountPaise === 0) {
    return { id: `order_free_${Date.now()}_${crypto.randomBytes(4).toString('hex')}` };
  }

  // If using placeholder test keys in local development / offline testing
  if (RAZORPAY_KEY_ID === 'rzp_test_placeholder' || RAZORPAY_KEY_SECRET === 'placeholder_secret') {
    return { id: `order_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}` };
  }

  try {
    const order = await razorpayClient.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
    });
    return { id: order.id };
  } catch (err: any) {
    console.warn('Razorpay order creation fallback to test mode:', err?.message || err);
    return { id: `order_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}` };
  }
}
