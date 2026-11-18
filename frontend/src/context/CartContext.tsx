import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartProduct, CartCalculation } from '../types';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartProduct[];
  itemCount: number;
  addToCart: (product: CartProduct) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  couponCode: string;
  setCouponCode: (code: string) => void;
  appliedCoupon: string | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; error?: string }>;
  removeCoupon: () => void;
  calculation: CartCalculation | null;
  calcLoading: boolean;
  calcError: string | null;
  recalculate: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'edtech_cart_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartProduct[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<CartCalculation | null>(null);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Calculate cart via /api/checkout/preview
  const recalculate = useCallback(async () => {
    if (items.length === 0) {
      setCalculation(null);
      setCalcError(null);
      return;
    }

    if (!user) {
      // If user is not logged in, build fallback offline calculation (18% GST split)
      const subtotalPaise = items.reduce((sum, item) => sum + item.pricePaise, 0);
      const discountPaise = 0;
      const totalPaise = subtotalPaise;
      const basePaise = Math.round((totalPaise * 100) / 118);
      const gstPaise = totalPaise - basePaise;

      setCalculation({
        lines: items.map((it) => ({
          item: {
            id: it.productId,
            productId: it.productId,
            title: it.title,
            type: it.type,
            pricePaise: it.pricePaise,
          },
          originalPricePaise: it.originalPricePaise || it.pricePaise,
          upgradeCreditPaise: (it.originalPricePaise || it.pricePaise) - it.pricePaise,
          finalPricePaise: it.pricePaise,
        })),
        subtotalPaise,
        discountPaise,
        totalPaise,
        basePaise,
        gstPaise,
      });
      setCalcError(null);
      return;
    }

    setCalcLoading(true);
    setCalcError(null);

    try {
      const res = await fetch('/api/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId })),
          couponCode: appliedCoupon || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCalcError(data.error || 'Failed to calculate cart totals');
        // If coupon was invalid, reset applied coupon
        if (appliedCoupon && data.error?.toLowerCase().includes('coupon')) {
          setAppliedCoupon(null);
        }
      } else {
        setCalculation(data);
        setCalcError(null);
      }
    } catch (err: any) {
      setCalcError(err.message || 'Error communicating with pricing engine');
    } finally {
      setCalcLoading(false);
    }
  }, [items, appliedCoupon, user]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const addToCart = (product: CartProduct) => {
    setItems((prev) => {
      if (prev.some((p) => p.productId === product.productId)) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setCouponCode('');
    setCalculation(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const isInCart = (productId: string) => {
    return items.some((p) => p.productId === productId);
  };

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return { success: false, error: 'Please enter a coupon code' };
    }

    if (!user) {
      return { success: false, error: 'Please sign in to apply coupons' };
    }

    setCalcLoading(true);
    try {
      const res = await fetch('/api/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId })),
          couponCode: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCalcLoading(false);
        return { success: false, error: data.error || 'Invalid or expired coupon' };
      }

      setAppliedCoupon(trimmed);
      setCalculation(data);
      setCalcError(null);
      setCalcLoading(false);
      return { success: true };
    } catch (err: any) {
      setCalcLoading(false);
      return { success: false, error: err.message || 'Error applying coupon' };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount: items.length,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        couponCode,
        setCouponCode,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        calculation,
        calcLoading,
        calcError,
        recalculate,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
