import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  Receipt,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  order: {
    id: string;
    createdAt: string;
    status: string;
    amountPaise: number;
    razorpayOrderId: string;
  };
  seller: {
    companyName: string;
    address: string;
    gstin: string;
    cin: string;
    email: string;
    state: string;
  };
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  payment: {
    id: string;
    razorpayPaymentId: string;
    amountPaise: number;
    status: string;
    createdAt: string;
  } | null;
  items: {
    id: string;
    productId: string;
    title: string;
    type: string;
    hsnSac: string;
    quantity: number;
    totalPaise: number;
    basePaise: number;
    gstPaise: number;
  }[];
  taxBreakdown: {
    basePaise: number;
    cgstRate: number;
    cgstPaise: number;
    sgstRate: number;
    sgstPaise: number;
    totalGstRate: number;
    totalGstPaise: number;
    totalPaise: number;
  };
}

export const InvoicePage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/orders/${orderId}/invoice`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error('Access denied: You do not have permission to view this invoice (403)');
          }
          if (res.status === 404) {
            throw new Error('Order not found');
          }
          throw new Error(`Failed to load invoice (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setInvoice(data.invoice);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId, user]);

  const formatPrice = (paise?: number) => {
    if (paise === undefined || paise === null) return '₹0.00';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 mt-4">Generating official tax invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white rounded-3xl border border-gray-200 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Invoice Unavailable</h2>
          <p className="text-sm text-gray-500 mt-2">{error || 'Could not load invoice'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl text-xs hover:bg-gray-800 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { seller, buyer, order, payment, items, taxBreakdown } = invoice;

  return (
    <div className="min-h-screen bg-gray-100 py-6 sm:py-10 print:bg-white print:py-0">
      {/* Top Action Bar (Hidden on print) */}
      <div className="max-w-4xl mx-auto px-4 mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Press Print or Ctrl+P to save as PDF</span>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* Formal Tax Invoice Sheet */}
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-lg p-8 sm:p-12 print:shadow-none print:border-none print:rounded-none print:p-4 text-gray-900 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b-2 border-gray-900 gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Receipt className="w-6 h-6" />
              <span className="text-xl font-black uppercase tracking-tight text-gray-900">
                {seller.companyName}
              </span>
            </div>
            <p className="text-xs text-gray-600 max-w-sm leading-relaxed">{seller.address}</p>
            <p className="text-xs text-gray-600 mt-1">
              <span className="font-semibold text-gray-900">GSTIN:</span> {seller.gstin} |{' '}
              <span className="font-semibold text-gray-900">CIN:</span> {seller.cin}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-900">Email:</span> {seller.email}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-md mb-2">
              TAX INVOICE
            </span>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-gray-500">Invoice No:</span>{' '}
                <span className="font-mono font-bold text-gray-900">{invoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">Invoice Date:</span>{' '}
                <span className="font-semibold text-gray-900">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div>
                <span className="text-gray-500">State / Code:</span>{' '}
                <span className="font-semibold text-gray-900">{seller.state}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Order Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-gray-200 text-xs">
          <div>
            <span className="font-black text-gray-400 uppercase tracking-wider block mb-2">
              Bill To (Customer Details)
            </span>
            <h4 className="font-bold text-gray-900 text-sm">{buyer.name}</h4>
            <p className="text-gray-600 mt-0.5">{buyer.email}</p>
            <p className="text-gray-500 mt-1">Place of Supply: Inter-state / Intra-state online supply</p>
          </div>

          <div className="sm:text-right">
            <span className="font-black text-gray-400 uppercase tracking-wider block mb-2">
              Transaction Details
            </span>
            <div className="space-y-1 text-gray-700">
              <div>
                <span className="text-gray-500">Order ID:</span>{' '}
                <span className="font-mono font-semibold">{order.id}</span>
              </div>
              <div>
                <span className="text-gray-500">Razorpay Order ID:</span>{' '}
                <span className="font-mono">{order.razorpayOrderId}</span>
              </div>
              {payment && (
                <div>
                  <span className="text-gray-500">Razorpay Payment ID:</span>{' '}
                  <span className="font-mono font-bold text-blue-600">{payment.razorpayPaymentId}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Payment Status:</span>{' '}
                <span className="font-bold uppercase text-emerald-700">{order.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 text-[11px] font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Description of Services</th>
                <th className="py-2.5 px-3 text-center">SAC Code</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Taxable Value (Base)</th>
                <th className="py-2.5 px-3 text-right">GST (18%)</th>
                <th className="py-2.5 px-3 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="py-3 px-3 text-gray-500">{index + 1}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-gray-900 block">{item.title}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                      {item.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-gray-600">{item.hsnSac}</td>
                  <td className="py-3 px-3 text-center font-semibold text-gray-700">{item.quantity}</td>
                  <td className="py-3 px-3 text-right font-medium text-gray-700">
                    {formatPrice(item.basePaise)}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {formatPrice(item.gstPaise)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-gray-900">
                    {formatPrice(item.totalPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tax Summary & GST Split Breakdown */}
        <div className="pt-4 border-t-2 border-gray-900 flex flex-col sm:flex-row justify-between items-start gap-8">
          <div className="max-w-xs space-y-3">
            {/* Paid Stamp */}
            <div className="border-2 border-emerald-600 rounded-2xl p-4 bg-emerald-50/50 inline-block">
              <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Payment Confirmed
              </div>
              <p className="text-[11px] text-emerald-700">
                Amount received electronically via Razorpay gateway.
              </p>
            </div>

            <p className="text-[10px] text-gray-500 leading-relaxed">
              * Note: Higher education and online digital coaching materials categorized under SAC 999293 subject to 18% Goods and Services Tax (GST).
            </p>
          </div>

          <div className="w-full sm:w-80 bg-gray-50 p-5 rounded-2xl border border-gray-200 text-xs space-y-2.5">
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Taxable Value (Base):</span>
              <span>{formatPrice(taxBreakdown.basePaise)}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Central GST (CGST @ 9%):</span>
              <span>{formatPrice(taxBreakdown.cgstPaise)}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>State GST (SGST @ 9%):</span>
              <span>{formatPrice(taxBreakdown.sgstPaise)}</span>
            </div>

            <div className="pt-2 border-t border-gray-200 flex justify-between text-gray-800 font-semibold">
              <span>Total Tax (18% GST):</span>
              <span>{formatPrice(taxBreakdown.totalGstPaise)}</span>
            </div>

            <div className="pt-3 border-t-2 border-gray-900 flex justify-between items-baseline">
              <span className="font-black text-sm uppercase text-gray-900">Grand Total:</span>
              <span className="font-black text-xl text-blue-600">
                {formatPrice(taxBreakdown.totalPaise)}
              </span>
            </div>
          </div>
        </div>

        {/* Signatory & Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-[11px] text-gray-500">
          <div>
            <p className="font-semibold text-gray-700">Declaration:</p>
            <p className="max-w-md mt-0.5">
              This is a system-generated electronic tax invoice and does not require a physical signature under the Information Technology Act.
            </p>
          </div>

          <div className="text-right">
            <span className="font-bold text-gray-900 block">For EdTech Academy Private Limited</span>
            <span className="text-[10px] text-gray-400 block mt-6">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </div>
  );
};
