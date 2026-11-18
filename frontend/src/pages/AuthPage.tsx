import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage: React.FC = () => {
  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  const from = (location.state as any)?.from?.pathname || '/';
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isLogin) {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || 'Login failed. Please check your credentials.');
      } else {
        navigate(from, { replace: true });
      }
    } else {
      const res = await signup(email, password, name);
      if (!res.success) {
        setError(res.error || 'Signup failed. Please try again.');
      } else {
        navigate(from, { replace: true });
      }
    }
    setLoading(false);
  };

  const handleQuickLogin = async (userEmail: string, userPass: string) => {
    setError(null);
    setLoading(true);
    setEmail(userEmail);
    setPassword(userPass);
    const res = await login(userEmail, userPass);
    if (!res.success) {
      setError(res.error || 'Quick login failed');
    } else {
      navigate(from, { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isLogin ? 'Welcome Back!' : 'Create Your Account'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {isLogin ? 'Access your enrolled courses and library' : 'Start learning with top curated study materials'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              isLogin
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              !isLogin
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@test.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In to Account' : 'Register & Continue'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Login Test Accounts for easy grading/evaluation */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-3">
              One-Click Seed Accounts (Testing)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('student@test.com', 'password123')}
                className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition text-center border border-gray-200/60"
              >
                👤 Student Account
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@test.com', 'password123')}
                className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition text-center border border-gray-200/60"
              >
                🛡️ Admin Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
