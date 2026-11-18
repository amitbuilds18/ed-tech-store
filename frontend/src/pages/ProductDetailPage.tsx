import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Calendar,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { ProductInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetch(`/api/catalogue/products/${id}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Product not found or inactive');
        return res.json();
      })
      .then((data: any) => {
        const prod = data.product || data;
        if (prod) {
          setProduct(prod);
        } else {
          setError('Product not found or inactive');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, user]);

  const formatPrice = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0';
    return `₹${(paise / 100).toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 mt-4 text-sm">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white rounded-3xl border border-gray-200 max-w-md mx-auto">
          <p className="text-red-600 font-semibold mb-4">{error || 'Product not found'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Catalogue
          </Link>
        </div>
      </div>
    );
  }

  const isOwned = product.state === 'OWNED';
  const isUpgrade = product.state === 'UPGRADE';
  const hasUpgradeCredit = (product.upgradeCreditPaise ?? 0) > 0;
  const effectivePrice = product.finalPricePaise ?? product.pricePaise;
  const alreadyInCart = isInCart(product.id);

  const handleBuy = () => {
    addToCart({
      productId: product.id,
      title: product.title,
      type: product.type,
      pricePaise: effectivePrice,
      originalPricePaise: product.pricePaise,
      targetId: product.targetId,
    });
    navigate('/cart');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Catalogue
      </Link>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-8 text-white relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider">
              {product.type.replace('_', ' ')}
            </span>
            {isOwned && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/80 backdrop-blur-md text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Owned in Library
              </span>
            )}
            {isUpgrade && (
              <span className="px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Upgrade Credit Available
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{product.title}</h1>
          <p className="text-blue-100 text-sm mt-2 max-w-xl">
            {product.description || 'Full comprehensive digital course material, theoretical breakdowns, and revision sets.'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8 space-y-6">
          {/* State Card */}
          {isOwned ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900 text-base">You Own This Product</h3>
                  <p className="text-xs text-emerald-700">
                    Access is unlocked on your account. You can read all materials in your library.
                  </p>
                </div>
              </div>
              <Link
                to="/library"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
              >
                Go to My Library
              </Link>
            </div>
          ) : hasUpgradeCredit ? (
            <div className="p-6 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-purple-900 text-base">Upgrade Discount Applied!</h3>
                  <p className="text-xs text-purple-700">
                    You previously purchased individual chapters in this subject. Your paid amount has been deducted from the subject pack price!
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-purple-600 font-semibold block">You Save</span>
                <span className="text-lg font-extrabold text-purple-900">
                  {formatPrice(product.upgradeCreditPaise)}
                </span>
              </div>
            </div>
          ) : null}

          {/* Pricing & GST details */}
          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Price Details</span>
              <div className="flex items-baseline gap-3 mt-1">
                {hasUpgradeCredit ? (
                  <>
                    <span className="text-3xl font-extrabold text-gray-900">
                      {formatPrice(effectivePrice)}
                    </span>
                    <span className="line-through text-base text-gray-400">
                      {formatPrice(product.pricePaise)}
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-extrabold text-gray-900">
                    {formatPrice(product.pricePaise)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Inclusive of 18% GST (Calculated automatically at checkout)
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isOwned ? (
                <Link
                  to="/library"
                  className="w-full sm:w-auto text-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-md"
                >
                  Open in Library
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => addToCart({
                      productId: product.id,
                      title: product.title,
                      type: product.type,
                      pricePaise: effectivePrice,
                      originalPricePaise: product.pricePaise,
                      targetId: product.targetId,
                    })}
                    disabled={alreadyInCart}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-bold transition ${
                      alreadyInCart
                        ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    {alreadyInCart ? 'In Cart' : 'Add to Cart'}
                  </button>

                  <button
                    onClick={handleBuy}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200 transition flex items-center justify-center gap-2"
                  >
                    <span>Buy Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-100">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase">Verified Content</h4>
                <p className="text-xs text-gray-500 mt-0.5">Aligned with latest official syllabus</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-100">
              <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase">
                  {product.type === 'MONTHLY_PASS' ? '30 Days Access' : product.type === 'ANNUAL_PASS' ? '365 Days Access' : 'Lifetime Access'}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">Instant activation upon payment</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-100">
              <BookOpen className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase">Interactive Reader</h4>
                <p className="text-xs text-gray-500 mt-0.5">Secure, authenticated PDF streaming</p>
              </div>
            </div>
          </div>

          {/* Curriculum & Included Syllabus Breakdown */}
          {(product as any).syllabus && (
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    What's Included in this {(product as any).syllabus.scope === 'CLASS_PASS' ? 'Pass' : 'Pack'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(product as any).syllabus.boardName} &bull; {(product as any).syllabus.className}
                    {(product as any).syllabus.subjectName ? ` &bull; ${(product as any).syllabus.subjectName}` : ''}
                  </p>
                </div>
                {(product as any).syllabus.totalChapters && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                    {(product as any).syllabus.totalSubjects} Subjects &bull; {(product as any).syllabus.totalChapters} Chapters
                  </span>
                )}
              </div>

              {/* Class Pass Syllabus: List of Subjects & their Chapters */}
              {(product as any).syllabus.subjects && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {(product as any).syllabus.subjects.map((subj: any) => (
                    <div key={subj.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-gray-900 text-sm">{subj.name}</h4>
                        <span className="text-xs font-semibold text-gray-500">{subj.chaptersCount} Chapters</span>
                      </div>
                      <ul className="space-y-1.5">
                        {subj.chapters.map((ch: any) => (
                          <li key={ch.id} className="text-xs text-gray-700 flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-100">
                            <span className="truncate pr-2">{ch.order}. {ch.name}</span>
                            {ch.isFree && (
                              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                Free Preview
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Subject Pack Syllabus: List of Chapters */}
              {(product as any).syllabus.chapters && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-900 text-sm">All Included Chapters</h4>
                    <span className="text-xs font-semibold text-gray-500">{(product as any).syllabus.chaptersCount} Chapters</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(product as any).syllabus.chapters.map((ch: any) => (
                      <div key={ch.id} className="text-xs text-gray-700 flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-100">
                        <span className="truncate pr-2">{ch.order}. {ch.name}</span>
                        {ch.isFree && (
                          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                            Free Preview
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
