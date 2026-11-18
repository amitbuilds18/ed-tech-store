import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Lock,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PDFReaderPage: React.FC = () => {
  const { materialId } = useParams<{ materialId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!materialId) return;

    let activeUrl: string | null = null;
    setLoading(true);
    setIsLocked(false);
    setError(null);

    // Fetch PDF stream with credentials
    fetch(`/api/materials/${materialId}/file`, {
      method: 'GET',
      credentials: 'include', // Transmits session cookies
    })
      .then(async (res) => {
        if (res.status === 403) {
          setIsLocked(true);
          return;
        }

        if (res.status === 401) {
          setError('Please sign in to read this material.');
          return;
        }

        if (!res.ok) {
          setError(`Unable to load PDF (HTTP ${res.status})`);
          return;
        }

        const blob = await res.blob();
        activeUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(activeUrl);
      })
      .catch((err) => {
        setError(err.message || 'Network error while streaming PDF');
      })
      .finally(() => setLoading(false));

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [materialId, user]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-900 text-white overflow-hidden">
      {/* Reader Topbar */}
      <div className="h-14 bg-gray-950 border-b border-gray-800 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm tracking-tight text-gray-200">
              PDF Document Viewer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pdfBlobUrl && (
            <>
              <a
                href={pdfBlobUrl}
                download={`study_material_${materialId}.pdf`}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
              </a>
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
          )}

          <Link
            to="/library"
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition"
          >
            My Library
          </Link>
        </div>
      </div>

      {/* Reader Body */}
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
        {loading ? (
          <div className="text-center p-8">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">Streaming secure study PDF...</p>
          </div>
        ) : isLocked ? (
          /* HTTP 403 Forbidden Lock Screen */
          <div className="max-w-md w-full mx-4 p-8 bg-gray-950 rounded-3xl border border-gray-800 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Content Locked (403)</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              You do not have an active entitlement to access this PDF. 
              Please purchase the chapter, its subject pack, or a class pass to unlock.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                Browse Catalogue to Unlock
              </Link>
              <button
                onClick={() => navigate(-1)}
                className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-200 font-semibold transition"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="max-w-md w-full mx-4 p-8 bg-gray-950 rounded-3xl border border-gray-800 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white">Unable to Display PDF</h2>
            <p className="text-gray-400 text-sm mt-2">{error}</p>
            <Link
              to="/auth"
              className="mt-6 inline-block px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl"
            >
              Sign In
            </Link>
          </div>
        ) : pdfBlobUrl ? (
          <iframe
            src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full border-0 bg-white"
            title="Study PDF Document"
          />
        ) : (
          <p className="text-gray-500 text-sm">No PDF data available.</p>
        )}
      </div>
    </div>
  );
};
