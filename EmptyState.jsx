import './ui.css';

// ============================================================
//  src/components/ui/EmptyState.jsx
//
//  Generic "no data" placeholder used wherever a list/table
//  might legitimately be empty (not an error — just nothing
//  to show yet).
//
//  Usage:
//    <EmptyState title="لا توجد حملات بعد" />
//
//    <EmptyState
//      icon="⚠️"
//      title="خطأ"
//      message="تعذّر تحميل البيانات، حاول مرة أخرى"
//    />
//
//    <EmptyState
//      title="لا يوجد عملاء مسجّلون"
//      action={<button className="btn btn-primary">تسجيل عميل</button>}
//    />
// ============================================================

export function EmptyState({
  icon = '📭',
  title = 'لا توجد بيانات',
  message,
  action
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {message && <div className="empty-state-message">{message}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
