import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import Inventory from './pages/Inventory.jsx';
import Settings from './pages/Settings.jsx';
import Customers from './pages/Customers.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceBuilder from './pages/InvoiceBuilder.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Estimates from './pages/Estimates.jsx';
import EstimateBuilder from './pages/EstimateBuilder.jsx';
import EstimateApproval from './pages/EstimateApproval.jsx';
import CalendarPage from './pages/Calendar.jsx';

export default function App() {
  const location = useLocation();

  // Public routes — no sidebar, no auth required
  const publicPaths = ['/', '/login'];
  const isPublic = publicPaths.includes(location.pathname) ||
                   /\/invoices\/.+\/view/.test(location.pathname) ||
                   /\/approve\//.test(location.pathname);

  if (isPublic) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/approve/:token" element={<EstimateApproval />} />
        <Route path="/invoices/:id/view" element={<InvoiceView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Authenticated routes — sidebar + protected
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceBuilder />} />
            <Route path="/invoices/:id/edit" element={<InvoiceBuilder />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/estimates/new" element={<EstimateBuilder />} />
            <Route path="/estimates/:id/edit" element={<EstimateBuilder />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </ProtectedRoute>
  );
}
