import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './layout.css';

// ============================================================
//  src/layouts/AppLayout.jsx
//
//  The authenticated app shell — wraps every protected page
//  via <Outlet />. Rendered once by the router; Sidebar/Topbar
//  persist across navigation while only the page content
//  inside <Outlet /> changes.
//
//  Mobile-first: sidebar is hidden off-screen on small screens
//  by default, toggled via the hamburger button in Topbar.
//  On desktop, it can be collapsed to icon-only width instead.
// ============================================================

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Dark overlay behind the sidebar on mobile — tapping it closes the menu */}
      <div
        className={`sidebar-mobile-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <div className={`sidebar-mobile-wrap ${mobileOpen ? 'open' : ''}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      <div className="app-main">
        <Topbar onMenuClick={() => setMobileOpen((o) => !o)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
