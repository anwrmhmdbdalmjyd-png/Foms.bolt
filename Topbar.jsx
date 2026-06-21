import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useUnreadNotifications } from '../hooks/useNotifications';
import './layout.css';

// ============================================================
//  src/layouts/Topbar.jsx
//
//  Top bar shown on every authenticated page.
//  - Hamburger button (mobile only, toggles Sidebar)
//  - Notifications bell with live unread count badge
//  - Current user's name + role
//  - Logout button
// ============================================================

export function Topbar({ onMenuClick }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const { data: unread = [] } = useUnreadNotifications(profile?.id);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="القائمة">
        ☰
      </button>

      <div className="topbar-spacer" />

      <button
        className="topbar-notif-btn"
        onClick={() => navigate('/notifications')}
        aria-label="الإشعارات"
      >
        🔔
        {unread.length > 0 && <span className="topbar-notif-badge">{unread.length}</span>}
      </button>

      <div className="topbar-user">
        <div className="topbar-user-name">{profile?.full_name}</div>
        <div className="topbar-user-role">{roleLabel(profile?.role)}</div>
      </div>

      <button className="btn btn-outline btn-sm" onClick={handleLogout}>
        خروج
      </button>
    </header>
  );
}

function roleLabel(role) {
  if (role === 'admin')      return '🛡️ أدمن';
  if (role === 'supervisor') return '👔 مشرف';
  if (role === 'agent')      return '🏃 مندوب';
  return '';
}
