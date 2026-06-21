import { useAuth } from '../auth/useAuth';
import { useAllNotifications, useMarkNotificationRead } from '../hooks/useNotifications';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Notifications.jsx
//
//  Full notification history for the current user (read + unread).
//  The unread badge in Topbar.jsx uses a separate hook
//  (useUnreadNotifications) with its own realtime subscription —
//  this page uses useAllNotifications for the full list view.
//
//  ARCHITECTURE NOTE:
//  As documented in useNotifications.js itself, this hook queries
//  Supabase directly rather than going through a dedicated
//  notifications.service.js file — an intentional, scoped
//  exception since notification logic here is only 3 simple
//  operations (fetch unread, fetch all, mark as read).
// ============================================================

export function Notifications() {
  const { profile } = useAuth();
  const { data: notifications, isLoading } = useAllNotifications(profile?.id);
  const markRead = useMarkNotificationRead();

  if (isLoading) {
    return <Loader fullScreen label="جارٍ تحميل الإشعارات..." />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الإشعارات</h1>
          <p className="page-subtitle">آخر 50 إشعار مرتبط بحسابك</p>
        </div>
      </div>

      {!notifications || notifications.length === 0 ? (
        <EmptyState title="لا توجد إشعارات" message="ستظهر هنا أي تنبيهات تخص حسابك" />
      ) : (
        <div className="card notif-list">
          {notifications.map((n) => (
            <div key={n.id} className={`notif-item ${n.is_read ? 'read' : ''}`}>
              <div className="notif-icon">{iconForType(n.type)}</div>

              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-text">{readableBody(n.body, n.type)}</div>}
                <div className="notif-time">{new Date(n.created_at).toLocaleString('ar-EG')}</div>
              </div>

              {!n.is_read && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => markRead.mutate(n.id)}
                  disabled={markRead.isPending}
                >
                  تحديد كمقروء
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Icon per notification type ────────────────────────────────
function iconForType(type) {
  const map = {
    attendance: '✅',
    target: '🎯',
    budget: '💰',
    fraud: '🚨',
    expense: '💸',
    campaign: '📣',
    otp: '📩'
  };
  return map[type] || '🔔';
}

// ── OTP notifications store raw JSON in `body` — hide that
//    technical payload from the user and show a clean message
//    instead of leaking { otp, expiry } to the UI.
function readableBody(body, type) {
  if (type === 'otp') return 'تم إرسال كود تحقق (OTP) لعميل';
  return body;
}
