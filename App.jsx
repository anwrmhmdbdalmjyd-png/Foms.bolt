import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Unauthorized } from './auth/Unauthorized';
import { AppLayout } from './layouts/AppLayout';
import { Loader } from './components/ui/Loader';
import { Login } from './pages/Login';

// ============================================================
//  src/App.jsx
//
//  Top-level router. Wrapped by <AuthProvider> and
//  <QueryClientProvider> in main.jsx (next file).
//
//  LAZY LOADING:
//  Every page except Login is lazy-loaded via React.lazy().
//  Login is NOT lazy — it's the very first thing an
//  unauthenticated user sees, so loading it eagerly avoids an
//  unnecessary loading flash on the very first paint.
//
//  ROUTE GUARD STRATEGY:
//  - Public route: /login (no guard)
//  - Any authenticated user: wrapped in <ProtectedRoute /> (no roles prop)
//  - Role-restricted: <ProtectedRoute roles={['admin', 'supervisor']} />
//  - Catch-all: redirects unknown paths to /
// ============================================================

const Dashboard         = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Campaigns         = lazy(() => import('./pages/Campaigns').then(m => ({ default: m.Campaigns })));
const CampaignDetails   = lazy(() => import('./pages/CampaignDetails').then(m => ({ default: m.CampaignDetails })));
const Customers         = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const CustomerDetails   = lazy(() => import('./pages/CustomerDetails').then(m => ({ default: m.CustomerDetails })));
const Tasks             = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })));
const Attendance        = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Expenses          = lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const FraudDashboard    = lazy(() => import('./pages/FraudDashboard').then(m => ({ default: m.FraudDashboard })));
const Notifications     = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));

// Shared fallback shown while any lazy chunk is downloading
function PageLoader() {
  return <Loader fullScreen label="جارٍ تحميل الصفحة..." />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* ── Public ──────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* ── Authenticated shell ─────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>

            {/* Available to every authenticated role */}
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetails />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="notifications" element={<Notifications />} />

            {/* Admin + Supervisor only */}
            <Route element={<ProtectedRoute roles={['admin', 'supervisor']} />}>
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="campaigns/:id" element={<CampaignDetails />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="fraud" element={<FraudDashboard />} />
            </Route>

          </Route>
        </Route>

        {/* ── Catch-all ────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Suspense>
  );
}
