import { NavLink } from 'react-router-dom';
import { useRole } from '../auth/useRole';
import './layout.css';

// ============================================================
//  src/layouts/Sidebar.jsx
//
//  Role-based navigation. Each item declares which roles can
//  see it; items not matching the current role are filtered
//  out entirely (not just hidden via CSS).
//
//  REMINDER: This only controls what's visible in the nav.
//  Even if a user manually navigates to a hidden route, the
//  router's <ProtectedRoute roles={[...]} /> blocks rendering,
//  and Postgres RLS blocks the underlying data regardless.
// ============================================================

const NAV_ITEMS = [
  { to: '/',              label: 'الرئيسية',      icon: '🏠', roles: ['admin', 'supervisor', 'agent'] },
  { to: '/campaigns',     label: 'الحملات',       icon: '📣', roles: ['admin', 'supervisor'] },
  { to: '/customers',     label: 'العملاء',       icon: '👥', roles: ['admin', 'supervisor', 'agent'] },
  { to: '/tasks',         label: 'المهام',        icon: '📋', roles: ['admin', 'supervisor', 'agent'] },
  { to: '/attendance',    label: 'الحضور',        icon: '✅', roles: ['admin', 'supervisor', 'agent'] },
  { to: '/expenses',      label: 'المصاريف',      icon: '💸', roles: ['admin', 'supervisor'] },
  { to: '/fraud',         label: 'كشف الاحتيال', icon: '🚨', roles: ['admin', 'supervisor'] },
  { to: '/notifications', label: 'الإشعارات',     icon: '🔔', roles: ['admin', 'supervisor', 'agent'] }
];

export function Sidebar({ collapsed, onToggle }) {
  const { role } = useRole();
  const items = NAV_ITEMS.filter((item) => !role || item.roles.includes(role));

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">{collapsed ? '🛰️' : '🛰️ FOMS'}</span>
        <button className="sidebar-toggle" onClick={onToggle} aria-label="طي القائمة">
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-text">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
