import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { AlertCircle, RotateCcw, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

// Helper to load Razorpay Checkout script dynamically
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const Checkout: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { items, appliedCoupon, calculation, clearCart } = useCart();
  const navigate = useNavigate();

  // Payment states: 'idle' | 'failed'
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Call POST /checkout to create a fresh order and open Razorpay
  const handlePay = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: '/checkout' } } });
      return;
    }

    if (items.length === 0) {
      navigate('/cart');
      return;
    }

    // 5) Disable button while request is in progress
    setIsLoading(true);
    setPaymentStatus('idle');
    setErrorMessage('');

    try {
      // Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Razorpay SDK failed to load');

      // POST /checkout to create fresh order on backend
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId })),
          couponCode: appliedCoupon || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      const { orderId, razorpayOrderId, amountPaise, keyId } = data;

      // Razorpay Checkout options
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'EdTech Academy',
        description: `Order #${orderId.slice(0, 8)}`,
        order_id: razorpayOrderId,
        // 1) Pre-fill user name and email from logged-in user, contact empty
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: '', // Do NOT pre-fill a real phone number
        },
        theme: { color: '#2563EB' },
        handler: async (response: any) => {
          // Client payment succeeded: verify signature with backend
          try {
            await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
          } catch (e) {
            console.warn('Verify error:', e);
          } finally {
            clearCart();
            navigate(`/orders/${orderId}/status`);
          }
        },
        // 2) modal.ondismiss: show failed screen with Retry button and do not grant anything
        modal: {
          ondismiss: () => {
            setErrorMessage('Payment cancelled by user. Nothing was charged or granted.');
            setPaymentStatus('failed');
            setIsLoading(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);

      // 3) rzp.on("payment.failed", handler): show error description and Retry button
      rzp.on('payment.failed', (response: any) => {
        const desc = response.error?.description || 'Payment transaction failed';
        setErrorMessage(desc);
        setPaymentStatus('failed');
        setIsLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment initiation failed');
      setPaymentStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ⚡ 1-Click Instant Test Mode Payment Simulation (Bypasses Razorpay popup & OTP)
  const handleDevSimulatePayment = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    if (items.length === 0) return;

    setIsLoading(true);
    setPaymentStatus('idle');
    setErrorMessage('');

    try {
      // 1. Create fresh order on backend
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId })),
          couponCode: appliedCoupon || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize order');

      // 2. Simulate settlement directly without OTP / phone hurdles
      const simRes = await fetch('/api/payments/mock-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: data.orderId }),
      });

      const simData = await simRes.json();
      if (!simRes.ok) throw new Error(simData.error || 'Failed to simulate payment');

      // 3. Clear cart and redirect to order status
      clearCart();
      navigate(`/orders/${data.orderId}/status`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing test simulation');
      setPaymentStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (paise?: number) => {
    if (!paise) return '₹0';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  // 2) & 3) Failed screen with Retry button (Retry calls handlePay to create fresh order via POST /checkout)
  if (paymentStatus === 'failed') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Failed</h2>
          <p className="text-sm text-gray-600 mb-6">{errorMessage || 'Your payment could not be processed.'}</p>
          <div className="space-y-3">
            {/* Retry button calls handlePay to invoke POST /checkout for a fresh order */}
            <button
              onClick={handlePay}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isLoading ? 'Creating Fresh Order...' : 'Retry Payment'}</span>
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition"
            >
              Back to Cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
        <h2 className="text-2xl font-black text-gray-900">Checkout</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Items ({items.length})</span>
            <span>{formatPrice(calculation?.subtotalPaise)}</span>
          </div>
          {calculation && calculation.discountPaise > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Discount</span>
              <span>- {formatPrice(calculation.discountPaise)}</span>
            </div>
          )}
          <div className="pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
            <span>GST (18% inclusive)</span>
            <span>{formatPrice(calculation?.gstPaise)}</span>
          </div>
          <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
            <span className="font-bold text-gray-900">Total Payable</span>
            <span className="text-2xl font-black text-blue-600">{formatPrice(calculation?.totalPaise)}</span>
          </div>
        </div>

        {/* 5) Disable Pay button while request is in progress */}
        <button
          onClick={handlePay}
          disabled={isLoading || items.length === 0}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Pay {formatPrice(calculation?.totalPaise)}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* 4) Small note under Pay button */}
        <p className="text-xs text-gray-500 text-center">
          Test mode: use UPI success@razorpay (success) or failure@razorpay (failure).
        </p>

        {/* 1-Click Instant Dummy Pay (Dev / Test Mode) */}
        <button
          onClick={handleDevSimulatePayment}
          disabled={isLoading || items.length === 0}
          className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
          title="Test payment instantly without OTP or phone verification"
        >
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>⚡ 1-Click Instant Test Pay (No OTP / Bypass)</span>
        </button>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Secured 256-Bit Test Mode</span>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
