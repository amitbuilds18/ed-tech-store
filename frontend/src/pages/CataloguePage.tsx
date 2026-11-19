import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Lock,
  Unlock,
  ChevronRight,
  Layers,
  Calendar,
  Award,
} from 'lucide-react';
import { Board, ClassLevel, ProductInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const CataloguePage: React.FC = () => {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classData, setClassData] = useState<ClassLevel | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{ chapters: any[]; subjects: any[] } | null>(null);

  // 1. Load Boards
  useEffect(() => {
    fetch('/api/catalogue/boards', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: any) => {
        const boardList: Board[] = Array.isArray(data) ? data : data.boards || [];
        setBoards(boardList);
        if (boardList.length > 0) {
          setSelectedBoardId(boardList[0].id);
          if (boardList[0].classes && boardList[0].classes.length > 0) {
            setClasses(boardList[0].classes);
            setSelectedClassId(boardList[0].classes[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load boards:', err);
        setBoards([]);
      });
  }, [user]);

  // 2. Load Selected Class Details (subjects, chapters, passes with states)
  useEffect(() => {
    if (!selectedClassId) return;

    fetch(`/api/catalogue/classes/${selectedClassId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: any) => {
        const classObj: ClassLevel = data.class || data;
        setClassData(classObj);
      })
      .catch((err) => console.error('Failed to load class data:', err));
  }, [selectedClassId, user]);

  // 3. Search query debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/catalogue/search?q=${encodeURIComponent(searchQuery.trim())}`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data: any) => {
          const resObj = data.results || data;
          setSearchResults({
            chapters: resObj.chapters || [],
            subjects: resObj.subjects || [],
          });
        })
        .catch((err) => console.error('Search error:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handleBoardChange = (boardId: string) => {
    setSelectedBoardId(boardId);
    const b = (boards || []).find((x) => x.id === boardId);
    if (b && b.classes && b.classes.length > 0) {
      setClasses(b.classes);
      setSelectedClassId(b.classes[0].id);
    } else {
      setClasses([]);
      setSelectedClassId('');
      setClassData(null);
    }
  };


  const formatPrice = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0';
    return `₹${(paise / 100).toFixed(0)}`;
  };

  const handleAddToCart = (product: ProductInfo) => {
    addToCart({
      productId: product.id,
      title: product.title,
      type: product.type,
      pricePaise: product.finalPricePaise ?? product.pricePaise,
      originalPricePaise: product.pricePaise,
      targetId: product.targetId,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Search Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left: Heading & Search Input */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-blue-200 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Curated Syllabus & Study Materials
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Explore Course Catalogue
            </h1>
            <p className="mt-2 text-base text-blue-100">
              Choose individual chapters, comprehensive subject packs, or full-class passes. 
              Enjoy free sample previews for every first chapter!
            </p>

            {/* Search Input */}
            <div className="mt-6 relative">
              <Search className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chapters or subjects (e.g. Real Numbers, Mechanics, Light)..."
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white text-gray-900 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400/30 text-sm placeholder-gray-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-3 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Right: Quick Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3 shrink-0 lg:w-64">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-200 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xl font-black text-white leading-tight">50+</span>
                <span className="text-xs text-blue-200 font-medium">Curated Chapters</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-200 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xl font-black text-white leading-tight">10,000+</span>
                <span className="text-xs text-blue-200 font-medium">Active Students</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center gap-3.5 col-span-2 sm:col-span-1 lg:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xl font-black text-white leading-tight">4.9 / 5</span>
                <span className="text-xs text-blue-200 font-medium">Student Rating</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* If Searching, render Search Results View */}
      {searchResults ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Search Results for "{searchQuery}"
            </h2>
            <span className="text-sm text-gray-500">
              {searchResults.chapters.length + searchResults.subjects.length} matches found
            </span>
          </div>

          {searchResults.chapters.length === 0 && searchResults.subjects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-8">
              <p className="text-gray-500">No chapters or subjects matched your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.chapters.map((ch: any) => (
                <div
                  key={ch.id}
                  className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {ch.subject?.class?.name || 'Class'} • {ch.subject?.name || 'Subject'}
                      </span>
                      {ch.isFree && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Free Preview
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">{ch.title}</h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    {ch.state === 'OWNED' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Owned
                      </span>
                    ) : ch.product ? (
                      <button
                        onClick={() => handleAddToCart(ch.product)}
                        disabled={isInCart(ch.product.id)}
                        className={`text-xs font-semibold px-3 py-2 rounded-xl transition ${
                          isInCart(ch.product.id)
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isInCart(ch.product.id)
                          ? 'In Cart'
                          : `Buy Chapter • ${formatPrice(ch.product.finalPricePaise ?? ch.product.pricePaise)}`}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Included in pack</span>
                    )}

                    {ch.materials && ch.materials.length > 0 && (
                      <Link
                        to={`/reader/${ch.materials[0].id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        {ch.isFree || ch.state === 'OWNED' ? 'Read' : 'View'} <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Normal Hierarchy Browse View */
        <div className="space-y-8">
          {/* Board & Class Switcher */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Board:</span>
              {(boards || []).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBoardChange(b.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    selectedBoardId === b.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Class:</span>
              {(classes || []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    selectedClassId === c.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Class Passes Section (Monthly Pass & Annual Pass) */}
          {classData?.passes && classData.passes.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 p-6 rounded-3xl border border-purple-200/60 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Full Class Pass
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 mt-1">
                    Get Complete Access to All Subjects in {classData.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Unlock all chapters, PDFs, and upcoming additions with a flexible pass.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classData.passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {pass.type === 'MONTHLY_PASS' ? '30 Days Pass' : '365 Days Annual Pass'}
                        </span>
                        {pass.state === 'OWNED' && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active Pass
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{pass.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Full access to all subjects, chapters and downloadable materials.
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="text-xl font-extrabold text-gray-900">
                          {formatPrice(pass.pricePaise)}
                        </div>
                        <div className="text-[11px] text-gray-400">GST Inclusive</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/product/${pass.id}`}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-100 transition"
                        >
                          Details
                        </Link>
                        <button
                          onClick={() => handleAddToCart(pass)}
                          disabled={isInCart(pass.id)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                            isInCart(pass.id)
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                          }`}
                        >
                          {isInCart(pass.id)
                            ? 'In Cart'
                            : pass.state === 'OWNED'
                            ? 'Extend Pass'
                            : 'Get Pass'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subjects & Chapters Accordion/Cards */}
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-600" />
              Subjects in {classData?.name || 'Class'}
            </h2>

            {classData?.subjects?.map((subject) => (
              <div
                key={subject.id}
                className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Subject Header with Subject Pack Option */}
                <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900">{subject.name}</h3>
                      <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                        {subject.chapters?.length || 0} Chapters
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Includes study notes, chapter theory, and PDF practice problem sets.
                    </p>
                  </div>

                  {/* Subject Pack Product Card / Action */}
                  {subject.product && (
                    <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Subject Pack
                        </div>
                        <div className="flex items-center gap-1.5 justify-end">
                          {subject.product.upgradeCreditPaise && subject.product.upgradeCreditPaise > 0 ? (
                            <>
                              <span className="line-through text-xs text-gray-400">
                                {formatPrice(subject.product.pricePaise)}
                              </span>
                              <span className="text-sm font-extrabold text-blue-600">
                                {formatPrice(subject.product.finalPricePaise)}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-extrabold text-gray-900">
                              {formatPrice(subject.product.pricePaise)}
                            </span>
                          )}
                        </div>
                        {subject.product.upgradeCreditPaise && subject.product.upgradeCreditPaise > 0 && (
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            Save {formatPrice(subject.product.upgradeCreditPaise)} (Credit applied)
                          </div>
                        )}
                      </div>

                      {subject.state === 'OWNED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pack Owned
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(subject.product!)}
                          disabled={isInCart(subject.product.id)}
                          className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                            isInCart(subject.product.id)
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          }`}
                        >
                          {isInCart(subject.product.id) ? 'In Cart' : 'Buy Subject Pack'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Chapters List */}
                <div className="divide-y divide-gray-100">
                  {subject.chapters?.map((chapter, index) => (
                    <div
                      key={chapter.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/70 transition"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">
                              {chapter.title}
                            </span>
                            {chapter.isFree && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                <Unlock className="w-3 h-3" /> Free Preview
                              </span>
                            )}
                          </div>
                          {chapter.materials && chapter.materials.length > 0 && (
                            <span className="text-xs text-gray-400 block mt-0.5">
                              📄 {chapter.materials[0].title}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chapter Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* If Free or Owned, show Read PDF Button */}
                        {(chapter.isFree || chapter.state === 'OWNED') && chapter.materials && chapter.materials.length > 0 && (
                          <Link
                            to={`/reader/${chapter.materials[0].id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Read PDF
                          </Link>
                        )}

                        {/* Practice DPP Button */}
                        {(chapter.isFree || chapter.state === 'OWNED') && (
                          <Link
                            to={`/dpp/${chapter.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 text-xs font-bold transition shadow-xs"
                          >
                            <Award className="w-3.5 h-3.5" /> Practice DPP
                          </Link>
                        )}

                        {/* If chapter has a product and is not offered or owned */}
                        {chapter.state === 'OWNED' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Owned
                          </span>
                        ) : chapter.product?.isOffered ? (
                          <button
                            onClick={() => handleAddToCart(chapter.product!)}
                            disabled={isInCart(chapter.product.id)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                              isInCart(chapter.product.id)
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            {isInCart(chapter.product.id)
                              ? 'In Cart'
                              : `Buy • ${formatPrice(chapter.product.pricePaise)}`}
                          </button>
                        ) : (
                          !chapter.isFree && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Subject Pack Only
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
