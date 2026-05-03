import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/shared/Sidebar";
import Navbar from "./components/shared/Navbar";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { useAuthStore } from "./store/authStore";
import { useRealtime } from "./hooks/useRealtime";
import Login from "./pages/Login";
import POS from "./pages/POS";
import CustomerManager from "./pages/CustomerManager";
import StockManager from "./pages/StockManager";
import InvoiceHistory from "./pages/InvoiceHistory";
import Dashboard from "./pages/Dashboard";

function ProtectedLayout({ children }) {
  useRealtime();
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="min-h-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { user, initialized } = useAuthStore();
  if (!initialized) return <LoadingSpinner label="Initializing session..." />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <POS />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <CustomerManager />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <StockManager />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <InvoiceHistory />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
