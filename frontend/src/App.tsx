import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { CataloguePage } from './pages/CataloguePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { OrderStatusPage } from './pages/OrderStatusPage';
import { MyLibraryPage } from './pages/MyLibraryPage';
import { PDFReaderPage } from './pages/PDFReaderPage';
import { DPPTestPage } from './pages/DPPTestPage';
import { AuthPage } from './pages/AuthPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminCataloguePage } from './pages/AdminCataloguePage';
import { InvoicePage } from './pages/InvoicePage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 antialiased selection:bg-blue-600 selection:text-white">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Catalogue Browse & Search */}
                <Route path="/" element={<CataloguePage />} />
                <Route path="/catalogue" element={<Navigate to="/" replace />} />

                {/* Product Detail Page (Owned / Upgrade / Buy states) */}
                <Route path="/product/:id" element={<ProductDetailPage />} />

                {/* Shopping Cart with Coupon Field & 18% GST Breakdown */}
                <Route path="/cart" element={<CartPage />} />

                {/* Waiting for Payment & Order Status (3-second polling, Success & Failure with Retry) */}
                <Route path="/orders/:orderId/status" element={<OrderStatusPage />} />

                {/* Tax Invoice Page (Printable HTML with GST breakdown) */}
                <Route path="/orders/:orderId/invoice" element={<InvoicePage />} />

                {/* Student Library with Expiry Dates */}
                <Route path="/library" element={<MyLibraryPage />} />

                {/* Authenticated PDF Reader */}
                <Route path="/reader/:materialId" element={<PDFReaderPage />} />

                {/* PW-Style Daily Practice Problems (DPP) & Interactive Quiz */}
                <Route path="/dpp/:chapterId" element={<DPPTestPage />} />

                {/* Admin-only Catalogue CMS & Orders Management */}
                <Route path="/admin/catalogue" element={<AdminCataloguePage />} />
                <Route path="/admin/orders" element={<AdminOrdersPage />} />
                <Route path="/admin" element={<Navigate to="/admin/catalogue" replace />} />

                {/* Login & Signup */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/signup" element={<Navigate to="/auth" replace />} />

                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
