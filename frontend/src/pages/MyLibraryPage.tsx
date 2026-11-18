import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Library,
  BookOpen,
  Layers,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MyLibraryPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [libraryData, setLibraryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = () => {
    setLoading(true);
    fetch('/api/library', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Please sign in to view your library');
          }
          throw new Error('Failed to load library items');
        }
        return res.json();
      })
      .then((data) => {
        setLibraryData(data.library);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLibrary();
  }, [user]);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Lifetime Access';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (isoString: string | null) => {
    if (!isoString) return null;
    const diffMs = new Date(isoString).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 mt-4 text-sm font-medium">Loading your enrolled library...</p>
      </div>
    );
  }

  if (error || !isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Sign In Required</h2>
          <p className="text-sm text-gray-500 mt-2">
            Please sign in with your student account to access your enrolled courses and study materials.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  const { passes = [], subjects = [], chapters = [] } =
    libraryData || {};

  const isEmpty = passes.length === 0 && subjects.length === 0 && chapters.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-blue-200 mb-4">
            <Library className="w-3.5 h-3.5" /> Enrolled Learning Materials
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            My Study Library
          </h1>
          <p className="mt-2 text-sm text-blue-100">
            Access your unrevoked courses, view upcoming expiry deadlines, and open high-resolution interactive study PDFs.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 p-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Your Library is Empty</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            You don't hold active entitlements yet. Browse our catalogue to enroll in individual chapters, subject packs, or class passes.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 transition"
          >
            Browse Catalogue
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* 1. Active Class Passes */}
          {passes.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Active Class Passes ({passes.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {passes.map((pass: any) => {
                  const daysLeft = getDaysRemaining(pass.expiresAt);
                  return (
                    <div
                      key={pass.classId}
                      className="bg-white p-6 rounded-3xl border border-purple-200 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
                            {pass.boardName} • {pass.className}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mt-2">
                          All Subjects Pass: {pass.className}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Unrestricted access across all {pass.subjectsCount} subjects and chapter materials.
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="w-4 h-4 text-purple-600" />
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">Expires On</span>
                            <span className="font-semibold text-gray-900">{formatDate(pass.expiresAt)}</span>
                          </div>
                        </div>

                        {daysLeft !== null && (
                          <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1.5 rounded-xl">
                            {daysLeft} days remaining
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Owned Subject Packs */}
          {subjects.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Owned Subject Packs ({subjects.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subjects.map((subj: any) => (
                  <div
                    key={subj.id}
                    className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {subj.class?.board?.name} • {subj.class?.name}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Lifetime Access
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">{subj.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        All {subj.chaptersCount} chapters and future additions included.
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {subj.chapters?.length || 0} chapters unlocked
                      </span>
                      <Link
                        to="/"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        Browse chapters <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Owned Individual Chapters */}
          {chapters.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Individual Owned Chapters ({chapters.length})
              </h2>

              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {chapters.map((ch: any) => (
                  <div
                    key={ch.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/70 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {ch.subject?.class?.name} • {ch.subject?.name}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Lifetime
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base">{ch.name}</h4>
                    </div>

                    <div className="flex items-center gap-3">
                      {ch.materials && ch.materials.length > 0 ? (
                        <Link
                          to={`/reader/${ch.materials[0].id}`}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Read Study PDF</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">No PDF uploaded</span>
                      )}

                      <Link
                        to={`/dpp/${ch.id}`}
                        className="px-3.5 py-2 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition flex items-center gap-1.5 shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Practice DPP</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
