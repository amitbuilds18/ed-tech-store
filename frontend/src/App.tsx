import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle, ShieldCheck } from 'lucide-react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status === 'ok' ? 'Connected' : 'Error'))
      .catch(() => setBackendStatus('Backend unreachable'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Ed-Tech Platform</h1>
        <p className="text-sm text-gray-500 mb-6">
          Catalogue & Entitlements Engine is initialized.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> Frontend
            </span>
            <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
              Vite + React + Tailwind
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> Backend API
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              backendStatus === 'Connected'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {backendStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
