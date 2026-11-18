import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ShoppingCart, User, LogOut, Library, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 text-blue-600 hover:text-blue-700 transition">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-gray-900">EdTech</span>
                <span className="text-xs block text-blue-600 font-semibold uppercase tracking-wider -mt-1">Academy</span>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition flex items-center gap-1.5"
              >
                Catalogue
              </Link>
              <Link
                to="/library"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition flex items-center gap-1.5"
              >
                <Library className="w-4 h-4 text-gray-500" />
                My Library
              </Link>
              {user?.role === 'ADMIN' && (
                <>
                  <Link
                    to="/admin/catalogue"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Catalogue CMS
                  </Link>
                  <Link
                    to="/admin/orders"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-700 transition"
                  >
                    <Shield className="w-3.5 h-3.5" /> Admin Orders
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            {/* Cart Link */}
            <Link
              to="/cart"
              className="relative p-2 text-gray-600 hover:text-blue-600 transition rounded-xl hover:bg-gray-100"
              title="Cart"
            >
              <ShoppingCart className="w-6 h-6" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* User Auth */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-semibold text-gray-900 truncate max-w-[150px]">
                    {user?.name || user?.email}
                  </div>
                  <div className="text-[11px] text-gray-500 capitalize">{user?.role.toLowerCase()}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
              >
                <User className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
