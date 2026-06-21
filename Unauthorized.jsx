import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import '../pages/auth/auth.css';

// ============================================================
//  src/auth/Unauthorized.jsx
//
//  Shown when a user is authenticated but tries to access
//  a route their role is not permitted to visit.
//
//  Provides two actions:
//  - Go back to home (dashboard)
//  - Logout and return to login page
// ============================================================

export function Unauthorized() {
  const navigate  = useNavigate();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="unauthorized-screen">

      <div className="unauthorized-icon">🚫</div>

      <h1 className="unauthorized-title">
        ليس لديك صلاحية الوصول
      </h1>

      <p className="unauthorized-message">
        هذه الصفحة غير متاحة لدورك الحالي.
        <br />
        تواصل مع الإدارة إذا كنت تعتقد أن هذا خطأ.
      </p>

      <div className="unauthorized-actions">
        <button
          className="btn btn-primary"
          onClick={() => navigate('/', { replace: true })}
        >
          العودة للرئيسية
        </button>

        <button
          className="btn btn-outline"
          onClick={handleLogout}
        >
          تسجيل الخروج
        </button>
      </div>

    </div>
  );
}
