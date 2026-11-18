import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Plus,
  BookOpen,
  Trash2,
  Upload,
  Unlock,
  Lock,
  ExternalLink,
  RotateCcw,
  Layers,
  AlertTriangle,
  X,
  FileText,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Board, ClassLevel, Subject, Chapter, ProductInfo } from '../types';

export const AdminCataloguePage: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classData, setClassData] = useState<ClassLevel | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [showBoardModal, setShowBoardModal] = useState<boolean>(false);
  const [boardNameInput, setBoardNameInput] = useState<string>('');

  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [classNameInput, setClassNameInput] = useState<string>('');

  const [showSubjectModal, setShowSubjectModal] = useState<boolean>(false);
  const [subjectNameInput, setSubjectNameInput] = useState<string>('');

  const [showChapterModal, setShowChapterModal] = useState<boolean>(false);
  const [targetSubjectId, setTargetSubjectId] = useState<string>('');
  const [chapterNameInput, setChapterNameInput] = useState<string>('');
  const [chapterIsFreeInput, setChapterIsFreeInput] = useState<boolean>(false);

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadChapterId, setUploadChapterId] = useState<string>('');
  const [uploadChapterTitle, setUploadChapterTitle] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [materialTitleInput, setMaterialTitleInput] = useState<string>('');

  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductInfo | null>(null);
  const [productPriceInput, setProductPriceInput] = useState<string>('');

  // 1. Load Boards
  const loadBoards = async (selectBoardId?: string, selectClassId?: string) => {
    try {
      const res = await fetch('/api/admin/boards', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load boards');
      const data = await res.json();
      const boardList: Board[] = data.boards || [];
      setBoards(boardList);

      if (boardList.length > 0) {
        const targetBId = selectBoardId || (selectedBoardId ? selectedBoardId : boardList[0].id);
        setSelectedBoardId(targetBId);

        const b = boardList.find((x) => x.id === targetBId) || boardList[0];
        if (b.classes && b.classes.length > 0) {
          setClasses(b.classes);
          const targetCId = selectClassId || (selectedClassId ? selectedClassId : b.classes[0].id);
          setSelectedClassId(targetCId);
        } else {
          setClasses([]);
          setSelectedClassId('');
          setClassData(null);
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error loading boards' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Load Selected Class details (subjects, chapters, materials, products)
  const loadClassData = async () => {
    if (!selectedClassId) return;
    try {
      const res = await fetch(`/api/catalogue/classes/${selectedClassId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load class content');
      const data = await res.json();
      setClassData(data.class || data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error loading class hierarchy' });
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadBoards();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassData();
    }
  }, [selectedClassId]);

  const handleBoardChange = (bId: string) => {
    setSelectedBoardId(bId);
    const b = boards.find((x) => x.id === bId);
    if (b && b.classes && b.classes.length > 0) {
      setClasses(b.classes);
      setSelectedClassId(b.classes[0].id);
    } else {
      setClasses([]);
      setSelectedClassId('');
      setClassData(null);
    }
  };

  // Auto-dismiss feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // =============================================================
  // MUTATION HANDLERS
  // =============================================================

  // Create Board
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardNameInput.trim()) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: boardNameInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create board');

      setFeedback({ type: 'success', message: `Board "${data.board.name}" created!` });
      setShowBoardModal(false);
      setBoardNameInput('');
      await loadBoards(data.board.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Create Class
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classNameInput.trim() || !selectedBoardId) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: classNameInput.trim(), boardId: selectedBoardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create class');

      setFeedback({ type: 'success', message: `Class "${data.class.name}" created!` });
      setShowClassModal(false);
      setClassNameInput('');
      await loadBoards(selectedBoardId, data.class.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectNameInput.trim() || !selectedClassId) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: subjectNameInput.trim(), classId: selectedClassId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create subject');

      setFeedback({ type: 'success', message: `Subject "${data.subject.name}" added!` });
      setShowSubjectModal(false);
      setSubjectNameInput('');
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!window.confirm(`Are you sure you want to delete subject "${subjectName}" and all its chapters?`)) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/subjects/${subjectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete subject');

      setFeedback({ type: 'success', message: `Subject "${subjectName}" deleted.` });
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Create Chapter
  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterNameInput.trim() || !targetSubjectId) return;
    setActionLoading(true);

    try {
      const currentSubj = classData?.subjects?.find((s) => s.id === targetSubjectId);
      const nextOrder = (currentSubj?.chapters?.length || 0) + 1;

      const res = await fetch('/api/admin/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: chapterNameInput.trim(),
          subjectId: targetSubjectId,
          order: nextOrder,
          isFree: chapterIsFreeInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create chapter');

      setFeedback({ type: 'success', message: `Chapter "${data.chapter.name}" created!` });
      setShowChapterModal(false);
      setChapterNameInput('');
      setChapterIsFreeInput(false);
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Free status
  const handleToggleFree = async (chapterId: string, currentStatus: boolean) => {
    // Optimistic UI update
    if (classData && classData.subjects) {
      const updatedSubjects = classData.subjects.map((s) => ({
        ...s,
        chapters: (s.chapters || []).map((c) =>
          c.id === chapterId ? { ...c, isFree: !currentStatus } : c
        ),
      }));
      setClassData({ ...classData, subjects: updatedSubjects });
    }

    try {
      const res = await fetch(`/api/admin/chapters/${chapterId}/toggle-free`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');

      setFeedback({
        type: 'success',
        message: `Chapter marked as ${!currentStatus ? 'FREE PREVIEW' : 'PAID'}.`,
      });
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      await loadClassData();
    }
  };

  // Delete Chapter
  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    if (!window.confirm(`Delete chapter "${chapterTitle}"? This will also remove any uploaded PDF.`)) return;

    try {
      const res = await fetch(`/api/admin/chapters/${chapterId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete chapter');

      setFeedback({ type: 'success', message: `Chapter "${chapterTitle}" removed.` });
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Upload PDF Material
  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !uploadChapterId) {
      setFeedback({ type: 'error', message: 'Please select a PDF file (max 10MB).' });
      return;
    }

    if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
      setFeedback({ type: 'error', message: 'Only PDF documents are supported.' });
      return;
    }

    if (pdfFile.size > 10 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'PDF file size exceeds 10MB limit.' });
      return;
    }

    setActionLoading(true);
    const formData = new FormData();
    formData.append('file', pdfFile);
    if (materialTitleInput.trim()) {
      formData.append('title', materialTitleInput.trim());
    }

    try {
      const res = await fetch(`/api/admin/chapters/${uploadChapterId}/materials`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PDF upload failed');

      setFeedback({ type: 'success', message: 'PDF study material uploaded successfully!' });
      setShowUploadModal(false);
      setPdfFile(null);
      setMaterialTitleInput('');
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Material
  const handleDeleteMaterial = async (materialId: string, title: string) => {
    if (!window.confirm(`Delete PDF "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete material');

      setFeedback({ type: 'success', message: `PDF "${title}" deleted.` });
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Edit Product Price
  const handleSaveProductPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const priceRupees = parseFloat(productPriceInput);
    if (isNaN(priceRupees) || priceRupees < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid price in Rupees.' });
      return;
    }

    setActionLoading(true);
    const pricePaise = Math.round(priceRupees * 100);

    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pricePaise }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product price');

      setFeedback({ type: 'success', message: `Product price updated to ₹${priceRupees}!` });
      setShowProductModal(false);
      setEditingProduct(null);
      await loadClassData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0';
    return `₹${(paise / 100).toFixed(0)}`;
  };

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white rounded-3xl border border-gray-200 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Administrator Access Required</h2>
          <p className="text-sm text-gray-500 mt-2">
            You must be signed in as an administrator to access the course catalogue builder.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-block px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-blue-700 transition"
          >
            Sign In as Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-bold uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" /> Content Management System
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Catalogue & Material Builder</h1>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Create educational levels, subjects, and chapters. Toggle free preview flags and upload course study PDFs.
          </p>
        </div>

        <button
          onClick={() => {
            loadBoards();
            loadClassData();
          }}
          disabled={loading || actionLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition self-start md:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Tree</span>
        </button>
      </div>

      {/* Floating Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-sm transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hierarchy Switcher & Creation Bar */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
        {/* Board Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Board:</span>
            {(boards || []).map((b) => (
              <button
                key={b.id}
                onClick={() => handleBoardChange(b.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedBoardId === b.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowBoardModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Board</span>
          </button>
        </div>

        {/* Class Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Class Level:</span>
            {(classes || []).map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedClassId === c.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {selectedBoardId && (
            <button
              onClick={() => setShowClassModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Class</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Class Editor View */}
      {selectedClassId && classData ? (
        <div className="space-y-6">
          {/* Class Header with Pass and Subject Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Active Curriculum</span>
              <h2 className="text-2xl font-black text-gray-900 mt-0.5">
                {classData.name} ({(classData.subjects || []).length} Subjects)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowSubjectModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Subject</span>
              </button>
            </div>
          </div>

          {/* Class Passes Products (Monthly & Annual Pass) */}
          {classData.passes && classData.passes.length > 0 && (
            <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 p-5 rounded-2xl border border-purple-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Class Passes Pricing
                </span>
                <span className="text-[11px] text-gray-500">Click product to edit price</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {classData.passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{pass.title}</h4>
                      <span className="text-xs text-gray-500 font-medium">
                        {pass.type === 'MONTHLY_PASS' ? '30 Days Access' : '365 Days Access'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">
                        {formatPrice(pass.pricePaise)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingProduct(pass);
                          setProductPriceInput((pass.pricePaise / 100).toString());
                          setShowProductModal(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        Edit Price
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subjects and Chapters Container */}
          <div className="space-y-6">
            {(classData.subjects || []).length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 p-8">
                <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900">No subjects yet</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Click "+ New Subject" to add courses like Mathematics, Science, or Physics.
                </p>
              </div>
            ) : (
              (classData.subjects || []).map((subject: Subject) => (
                <div
                  key={subject.id}
                  className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  {/* Subject Header */}
                  <div className="p-5 sm:p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
                        {subject.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-gray-900 text-lg">{subject.name}</h3>
                        <span className="text-xs text-gray-500">
                          {(subject.chapters || []).length} Chapters
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {subject.product && (
                        <div className="flex items-center gap-2 mr-3 px-3 py-1.5 bg-gray-100 rounded-xl">
                          <span className="text-xs text-gray-500 font-semibold">Subject Pack:</span>
                          <span className="text-xs font-black text-gray-900">
                            {formatPrice(subject.product.pricePaise)}
                          </span>
                          <button
                            onClick={() => {
                              setEditingProduct(subject.product!);
                              setProductPriceInput((subject.product!.pricePaise / 100).toString());
                              setShowProductModal(true);
                            }}
                            className="text-[11px] font-bold text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setTargetSubjectId(subject.id);
                          setShowChapterModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Chapter</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSubject(subject.id, subject.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Delete subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chapters List */}
                  <div className="divide-y divide-gray-100">
                    {(subject.chapters || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">
                        No chapters added yet. Click "+ Add Chapter" to create lessons.
                      </div>
                    ) : (
                      (subject.chapters || []).map((chapter: Chapter, idx: number) => (
                        <div
                          key={chapter.id}
                          className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 transition"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900 text-sm">{chapter.title}</h4>
                                {chapter.isFree ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    <Unlock className="w-3 h-3 text-emerald-600" /> Free Preview
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    <Lock className="w-3 h-3 text-gray-400" /> Paid
                                  </span>
                                )}
                              </div>

                              {/* Attached PDF Materials */}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {(chapter.materials || []).map((m) => (
                                  <div
                                    key={m.id}
                                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="font-semibold truncate max-w-[150px]">{m.title}</span>
                                    <Link
                                      to={`/reader/${m.id}`}
                                      target="_blank"
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Open PDF viewer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </Link>
                                    <button
                                      onClick={() => handleDeleteMaterial(m.id, m.title)}
                                      className="text-gray-400 hover:text-red-600"
                                      title="Delete PDF"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}

                                {(chapter.materials || []).length === 0 && (
                                  <span className="text-[11px] text-gray-400 italic">No PDF uploaded</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Chapter Control Actions */}
                          <div className="flex items-center gap-3 self-end md:self-auto">
                            {/* Toggle Free Preview Button */}
                            <button
                              onClick={() => handleToggleFree(chapter.id, chapter.isFree)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                chapter.isFree
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              title="Toggle free preview access"
                            >
                              {chapter.isFree ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              <span>{chapter.isFree ? 'Mark Paid' : 'Make Free'}</span>
                            </button>

                            {/* Upload PDF Material Button */}
                            <button
                              onClick={() => {
                                setUploadChapterId(chapter.id);
                                setUploadChapterTitle(chapter.title);
                                setShowUploadModal(true);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload PDF</span>
                            </button>

                            {/* Delete Chapter */}
                            <button
                              onClick={() => handleDeleteChapter(chapter.id, chapter.title)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete chapter"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 p-8">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">Select a Class Level</h3>
          <p className="text-xs text-gray-500 mt-1">
            Pick a class level or create a new one to manage subjects and learning materials.
          </p>
        </div>
      )}

      {/* =============================================================
          MODALS
         ============================================================= */}

      {/* 1. Create Board Modal */}
      {showBoardModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-base">Create New Board</h3>
              <button onClick={() => setShowBoardModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Board Name</label>
                <input
                  type="text"
                  required
                  value={boardNameInput}
                  onChange={(e) => setBoardNameInput(e.target.value)}
                  placeholder="e.g. ICSE, State Board"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBoardModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !boardNameInput.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  Create Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-base">Create New Class Level</h3>
              <button onClick={() => setShowClassModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  placeholder="e.g. Class 12, Grade 9"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !classNameInput.trim()}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-base">Add New Subject</h3>
              <button onClick={() => setShowSubjectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subjectNameInput}
                  onChange={(e) => setSubjectNameInput(e.target.value)}
                  placeholder="e.g. Biology, Social Studies"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !subjectNameInput.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  Add Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Chapter Modal */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-base">Add New Chapter</h3>
              <button onClick={() => setShowChapterModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Chapter Title</label>
                <input
                  type="text"
                  required
                  value={chapterNameInput}
                  onChange={(e) => setChapterNameInput(e.target.value)}
                  placeholder="e.g. Newton's Laws of Motion"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  id="freeCheckbox"
                  checked={chapterIsFreeInput}
                  onChange={(e) => setChapterIsFreeInput(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="freeCheckbox" className="text-xs font-semibold text-gray-800 cursor-pointer">
                  Mark as Free Preview sample
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowChapterModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !chapterNameInput.trim()}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  Create Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Upload PDF Material Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">Upload Study PDF</h3>
                <span className="text-xs text-gray-500 truncate block max-w-xs">{uploadChapterTitle}</span>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadPdf} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  PDF Document (Max 10 MB)
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Material Title (Optional)
                </label>
                <input
                  type="text"
                  value={materialTitleInput}
                  onChange={(e) => setMaterialTitleInput(e.target.value)}
                  placeholder="e.g. Complete Chapter Theory Notes.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !pdfFile}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Uploading...' : 'Upload PDF'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Edit Product Price Modal */}
      {showProductModal && editingProduct && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">Edit Product Price</h3>
                <span className="text-xs text-gray-500 truncate block max-w-xs">{editingProduct.title}</span>
              </div>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductPrice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Price in Rupees (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={productPriceInput}
                    onChange={(e) => setProductPriceInput(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Inclusive of 18% GST ({Math.round((parseFloat(productPriceInput) || 0) * 100)} paise)
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
