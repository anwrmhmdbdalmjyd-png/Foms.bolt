import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import '../components/ui/ui.css';
import './auth.css';

// ============================================================
//  src/pages/Login.jsx
//
//  Public page — not wrapped by ProtectedRoute.
//  On success, redirects to wherever the user was trying to go
//  before being bounced to /login (state.from), or to / by default.
// ============================================================

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('البريد الإلكتروني وكلمة المرور مطلوبان');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'حدث خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🛰️</div>
        <h1 className="login-title">FOMS</h1>
        <p className="login-subtitle">Field Operations Management System</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
