import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  Library,
} from 'lucide-react';
import { OrderDetails } from '../types';
import { useAuth } from '../context/AuthContext';

// Helper to load Razorpay script
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

export const OrderStatusPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollCount, setPollCount] = useState<number>(0);
  const [retryLoading, setRetryLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  const fetchOrderStatus = async () => {
    if (!orderId) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('Order not found');
        } else if (res.status === 403) {
          setError('Access denied to view this order');
        }
        return;
      }

      const data: OrderDetails = await res.json();
      setOrder(data);
      setPollCount((prev) => prev + 1);

      // Stop polling if order has reached final state (PAID or FAILED)
      if (data.status === 'PAID' || data.status === 'FAILED') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('Polling error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();

    // Poll every 3 seconds (as requested)
    pollIntervalRef.current = setInterval(() => {
      fetchOrderStatus();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [orderId]);

  const formatPrice = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  // Retry checkout by re-launching Razorpay Checkout.js
  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryLoading(true);

    try {
      await loadRazorpayScript();

      // Fetch checkout details again to get active Razorpay key ID
      const keyId = 'rzp_test_placeholder'; // Test mode key

      const options = {
        key: keyId,
        amount: order.amountPaise,
        currency: 'INR',
        name: 'EdTech Academy',
        description: `Retry Order #${order.id.slice(0, 8)}`,
        order_id: order.razorpayOrderId,
        prefill: {
          email: user?.email || '',
        },
        theme: {
          color: '#2563EB',
        },
        handler: async (response: any) => {
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
            console.error('Verify error:', e);
          } finally {
            fetchOrderStatus();
          }
        },
        modal: {
          ondismiss: () => {
            fetchOrderStatus();
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert('Could not launch payment gateway: ' + err.message);
    } finally {
      setRetryLoading(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Loading order status...</h2>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white rounded-3xl border border-gray-200 shadow-sm">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Order Error</h2>
          <p className="text-sm text-gray-500 mt-2">{error || 'Could not find order'}</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm"
          >
            Return to Catalogue
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE 1: WAITING FOR PAYMENT (Status: CREATED) - Polls every 3s
  // -------------------------------------------------------------
  if (order.status === 'CREATED') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl border border-blue-100 shadow-xl p-8 relative overflow-hidden">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-5 relative">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>

          <h2 className="text-2xl font-black text-gray-900">Waiting for Payment</h2>
          <p className="text-sm text-gray-600 mt-2">
            Awaiting confirmation from Razorpay. Polling status every 3 seconds...
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Order ID:</span>
              <span className="font-mono font-semibold text-gray-800">{order.id.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount:</span>
              <span className="font-bold text-gray-900">{formatPrice(order.amountPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status Check Count:</span>
              <span className="text-blue-600 font-semibold">{pollCount} checks performed</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleRetryPayment}
              disabled={retryLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{retryLoading ? 'Opening...' : 'Open Payment Popup Again'}</span>
            </button>

            <Link
              to="/cart"
              className="text-xs text-gray-500 hover:text-gray-700 font-semibold py-2 transition"
            >
              Cancel and Return to Cart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE 2: SUCCESS SCREEN (Status: PAID)
  // -------------------------------------------------------------
  if (order.status === 'PAID') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl p-8 relative overflow-hidden">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            Payment Completed
          </span>
          <h2 className="text-3xl font-black text-gray-900 mt-2">Payment Successful!</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
            Your entitlements have been granted immediately. You can now access all learning materials in your library.
          </p>

          {/* Purchased Items List */}
          <div className="mt-6 p-5 rounded-2xl bg-gray-50 border border-gray-100 text-left space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Enrolled Content
            </h4>
            <div className="divide-y divide-gray-200/60">
              {order.items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-gray-900 block">{item.productTitle}</span>
                    <span className="text-[11px] text-gray-500 uppercase">{item.productType.replace('_', ' ')}</span>
                  </div>
                  <span className="font-bold text-gray-800">{formatPrice(item.pricePaise)}</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-sm">
              <span className="font-bold text-gray-900">Total Paid (with 18% GST):</span>
              <span className="text-lg font-black text-emerald-600">{formatPrice(order.amountPaise)}</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/library"
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-200 transition flex items-center justify-center gap-2"
            >
              <Library className="w-4 h-4" />
              <span>Go to My Library</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/"
              className="py-3.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition"
            >
              Browse Catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE 3: FAILURE SCREEN (Status: FAILED) with Retry Button
  // -------------------------------------------------------------
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-3xl border border-red-100 shadow-xl p-8">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-12 h-12" />
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full">
          Transaction Failed
        </span>
        <h2 className="text-2xl font-black text-gray-900 mt-2">Payment Unsuccessful</h2>
        <p className="text-sm text-gray-600 mt-1">
          The payment could not be captured or was canceled. No charges were made to your account.
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Order ID:</span>
            <span className="font-mono text-gray-700">{order.id.slice(0, 12)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount:</span>
            <span className="font-bold text-gray-900">{formatPrice(order.amountPaise)}</span>
          </div>
        </div>

        {/* Retry Button */}
        <div className="mt-6 space-y-2">
          <button
            onClick={handleRetryPayment}
            disabled={retryLoading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{retryLoading ? 'Initializing...' : 'Retry Payment'}</span>
          </button>

          <Link
            to="/cart"
            className="block w-full py-2.5 text-xs text-gray-500 hover:text-gray-700 font-semibold transition"
          >
            Return to Shopping Cart
          </Link>
        </div>
      </div>
    </div>
  );
};
