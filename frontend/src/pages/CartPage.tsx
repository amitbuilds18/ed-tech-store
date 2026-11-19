import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trash2,
  Tag,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

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

export const CartPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    items,
    removeFromCart,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    calculation,
    calcLoading,
    calcError,
  } = useCart();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState<string>('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const formatPrice = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (!couponInput.trim()) return;

    const res = await applyCoupon(couponInput);
    if (!res.success) {
      setCouponError(res.error || 'Failed to apply coupon');
    } else {
      setCouponInput('');
    }
  };

  const handleCheckout = async () => {
    setCheckoutError(null);

    // 1. Auth Guard
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: '/cart' } } });
      return;
    }

    if (items.length === 0) return;

    setCheckoutLoading(true);

    try {
      // 2. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 3. Initiate checkout on backend (DB loads source prices, creates Order + Razorpay Order)
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId })),
          couponCode: appliedCoupon || undefined,
        }),
      });

      const checkoutData = await res.json();
      if (!res.ok) {
        throw new Error(checkoutData.error || 'Failed to initialize checkout');
      }

      const { orderId, razorpayOrderId, amountPaise, keyId } = checkoutData;

      // 4. Open Razorpay Checkout modal
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'EdTech Academy',
        description: `Order #${orderId.slice(0, 8)}`,
        order_id: razorpayOrderId,
        prefill: {
          email: user?.email || '',
          name: user?.name || '',
          contact: '', // Leave contact empty to prevent Razorpay 1-Click login OTP lock
        },
        theme: {
          color: '#2563EB', // Blue-600
        },
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
            console.warn('Direct verify failed, fallback to polling/webhook:', e);
          } finally {
            clearCart();
            navigate(`/orders/${orderId}/status`);
          }
        },
        modal: {
          ondismiss: () => {
            // User closed the modal or payment is pending/failed: navigate to polling/status page
            navigate(`/orders/${orderId}/status`);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on('payment.failed', async (response: any) => {
        console.warn('Payment failed callback:', response.error);
        navigate(`/orders/${orderId}/status`);
      });

      razorpayInstance.open();
    } catch (err: any) {
      setCheckoutError(err.message || 'Error processing checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ⚡ 1-Click Instant Test Mode Payment Simulation (Bypasses Razorpay popup & OTP)
  const handleDevSimulatePayment = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: '/cart' } } });
      return;
    }
    if (items.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      // 1. Create order on backend
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
      setCheckoutError(err.message || 'Error processing test simulation');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Your Cart is Empty</h2>
        <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
          Explore our catalogue to discover chapters, full subject packs, and class passes.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 transition"
        >
          Browse Catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Shopping Cart</h1>
          <p className="text-xs text-gray-500 mt-0.5">{items.length} item(s) in your cart</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-600 hover:text-red-800 font-semibold transition"
        >
          Clear Cart
        </button>
      </div>

      {checkoutError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <span>{checkoutError}</span>
        </div>
      )}

      {calcError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
          <span>{calcError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const lineMatch = calculation?.lines?.find((l) => l.item.productId === item.productId);
            const linePrice = lineMatch ? lineMatch.finalPricePaise : item.pricePaise;
            const upgradeDiscount = lineMatch?.upgradeCreditPaise ?? 0;

            return (
              <div
                key={item.productId}
                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase">
                      {item.type.replace('_', ' ')}
                    </span>
                    {upgradeDiscount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" /> Upgrade Credit Applied
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{item.title}</h3>
                  {upgradeDiscount > 0 && (
                    <p className="text-xs text-purple-700 mt-0.5">
                      Reduced by {formatPrice(upgradeDiscount)} based on your previously purchased chapters
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {upgradeDiscount > 0 ? (
                      <>
                        <span className="text-xs text-gray-400 line-through block">
                          {formatPrice(item.originalPricePaise || item.pricePaise)}
                        </span>
                        <span className="text-lg font-extrabold text-gray-900">
                          {formatPrice(linePrice)}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-extrabold text-gray-900">
                        {formatPrice(linePrice)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Card with Coupon & GST Breakdown */}
        <div className="space-y-6">
          {/* Coupon Code Box */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" /> Apply Coupon
            </h3>

            {appliedCoupon ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs text-emerald-900 uppercase tracking-wider">
                    {appliedCoupon} APPLIED
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="p-1 text-emerald-700 hover:text-red-600 transition"
                  title="Remove coupon"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code (e.g. FLAT50, SAVE20)"
                    className="flex-1 px-3 py-2 text-sm uppercase rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={calcLoading || !couponInput.trim()}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {couponError && <p className="text-xs text-red-600">{couponError}</p>}
              </form>
            )}
          </div>

          {/* Price & GST Breakdown Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">
              Order Breakdown
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(calculation?.subtotalPaise)}</span>
              </div>

              {calculation && calculation.discountPaise > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Coupon Discount</span>
                  <span>- {formatPrice(calculation.discountPaise)}</span>
                </div>
              )}

              {/* 18% GST Split Breakdown */}
              <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Base Amount (excl. tax)</span>
                  <span>{formatPrice(calculation?.basePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (18% inclusive)</span>
                  <span>{formatPrice(calculation?.gstPaise)}</span>
                </div>
              </div>

              {/* Total (Inclusive of GST) */}
              <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                <div>
                  <span className="text-base font-extrabold text-gray-900 block">Total Amount</span>
                  <span className="text-[11px] text-gray-400">Inclusive of all taxes (18% GST)</span>
                </div>
                <span className="text-2xl font-black text-blue-600">
                  {formatPrice(calculation?.totalPaise)}
                </span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || calcLoading}
              className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkoutLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {isAuthenticated
                      ? `Proceed to Checkout • ${formatPrice(calculation?.totalPaise)}`
                      : 'Sign In to Checkout'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* 1-Click Instant Dummy Pay (Dev / Test Mode) */}
            <button
              onClick={handleDevSimulatePayment}
              disabled={checkoutLoading || calcLoading}
              className="w-full mt-2.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Test payment instantly without OTP or phone verification"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>⚡ 1-Click Instant Test Pay (No OTP / Bypass)</span>
            </button>

            <div className="pt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Razorpay Secured 256-Bit Test Mode</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
