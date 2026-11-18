import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Calendar,
  Filter,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  Layers,
  ArrowUpRight,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface AdminOrder {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED';
  amountPaise: number;
  razorpayOrderId: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  items: {
    id: string;
    pricePaise: number;
    product: {
      id: string;
      title: string;
      type: string;
    };
  }[];
  payments: {
    id: string;
    razorpayPaymentId: string;
    amountPaise: number;
    status: string;
    createdAt: string;
  }[];
}

export const AdminOrdersPage: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    try {
      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: Administrator privileges required (403)');
        }
        throw new Error(`Failed to load orders (HTTP ${res.status})`);
      }

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchOrders();
    }
  }, [isAdmin, statusFilter, startDate, endDate]);

  const handleResetFilters = () => {
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  };

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Metrics
  const totalRevenuePaise = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.amountPaise, 0);
  const paidCount = orders.filter((o) => o.status === 'PAID').length;
  const createdCount = orders.filter((o) => o.status === 'CREATED').length;
  const failedCount = orders.filter((o) => o.status === 'FAILED').length;

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
            You must be signed in as an administrator to access the orders management dashboard.
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
      <div className="bg-gradient-to-r from-gray-900 via-purple-950 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" /> Admin Control Center
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Orders & Payment Records</h1>
          <p className="text-sm text-gray-300 mt-1 max-w-xl">
            Real-time transaction overview, status filtering, and tax invoice generation for all student purchases.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition self-start md:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Orders</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{orders.length}</div>
          <span className="text-[11px] text-gray-500 mt-1 block">In current filter view</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Paid Revenue</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {formatPrice(totalRevenuePaise)}
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            {paidCount} successful payments
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Pending / Created</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{createdCount}</div>
          <span className="text-[11px] text-gray-500 mt-1 block">Awaiting payment capture</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Failed Orders</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 mt-2">{failedCount}</div>
          <span className="text-[11px] text-gray-500 mt-1 block">Zero entitlements granted</span>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PAID">PAID (Successful)</option>
            <option value="CREATED">CREATED (Pending)</option>
            <option value="FAILED">FAILED (Canceled)</option>
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-gray-700 focus:outline-none font-medium"
                title="Start Date"
              />
            </div>
            <span className="text-xs text-gray-400">to</span>
            <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-gray-700 focus:outline-none font-medium"
                title="End Date"
              />
            </div>
          </div>
        </div>

        {(statusFilter || startDate || endDate) && (
          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
          >
            Reset All Filters
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-3 font-medium">Filtering order records...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center p-8">
            <p className="text-gray-500 text-sm">No orders found matching the filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Order ID</th>
                  <th className="py-3.5 px-6">Customer</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Items Enrolled</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Payment Ref</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const payment = order.payments && order.payments.length > 0 ? order.payments[0] : null;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60 transition">
                      {/* Order ID */}
                      <td className="py-4 px-6 font-mono text-xs text-gray-800 font-semibold">
                        {order.id.slice(0, 8)}...
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-900 text-xs">
                          {order.user.name || 'Student'}
                        </div>
                        <div className="text-[11px] text-gray-500">{order.user.email}</div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-semibold text-gray-900">
                          {order.items.length} item(s)
                        </div>
                        <div className="text-[11px] text-gray-500 truncate max-w-[180px]">
                          {order.items.map((i) => i.product.title).join(', ')}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6 font-black text-gray-900 text-sm whitespace-nowrap">
                        {formatPrice(order.amountPaise)}
                      </td>

                      {/* Payment Ref */}
                      <td className="py-4 px-6 text-xs">
                        {payment ? (
                          <div>
                            <span className="font-mono text-gray-700 block text-[11px]">
                              {payment.razorpayPaymentId}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold capitalize">
                              ● {payment.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {order.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PAID
                          </span>
                        ) : order.status === 'CREATED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> CREATED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3 text-red-600" /> FAILED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          to={`/orders/${order.id}/invoice`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 text-xs font-bold transition"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
