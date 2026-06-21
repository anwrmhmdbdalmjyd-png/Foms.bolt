import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Loader } from '../components/ui/Loader';

// ============================================================
//  src/auth/ProtectedRoute.jsx
//
//  Route guard component used inside the React Router config.
//
//  Behaviour:
//  1. While session is being restored → show full-screen loader
//     (prevents flashing the login page on every refresh)
//  2. Not authenticated → redirect to /login (saves current
//     location so user returns there after logging in)
//  3. Authenticated but wrong role → redirect to /unauthorized
//  4. Authenticated + correct role → render <Outlet />
//
//  Usage in router:
//    <Route element={<ProtectedRoute />}>               ← any logged-in user
//    <Route element={<ProtectedRoute roles={['admin']} />}>  ← admin only
//    <Route element={<ProtectedRoute roles={['admin','supervisor']} />}>
//
//  REMINDER: This is a UI guard only.
//  Postgres RLS enforces the real data-level access control.
// ============================================================

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  // ── 1. Session restoring ──────────────────────────────────
  if (loading) {
    return (
      <Loader
        fullScreen
        label="جارٍ التحقق من الجلسة..."
      />
    );
  }

  // ── 2. Not authenticated ──────────────────────────────────
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // ── 3. Wrong role ─────────────────────────────────────────
  if (roles && roles.length > 0 && !roles.includes(role)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  // ── 4. Authorized ─────────────────────────────────────────
  return <Outlet />;
}
