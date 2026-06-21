import './ui.css';

// ============================================================
//  src/components/ui/Loader.jsx
//
//  Generic loading spinner used across the entire app.
//  Two modes:
//  - fullScreen: covers the whole viewport (used by ProtectedRoute
//    while the auth session is being restored)
//  - inline: sits inside a card/section while data loads
//    (used by DataTable, Dashboard KPI cards, etc.)
//
//  Usage:
//    <Loader fullScreen label="جارٍ التحقق من الجلسة..." />
//    <Loader label="جارٍ تحميل البيانات..." />
//    <Loader size="sm" label="" />   ← icon only, no label
// ============================================================

export function Loader({ label = 'جارٍ التحميل...', fullScreen = false, size = 'md' }) {
  return (
    <div className={fullScreen ? 'loader-fullscreen' : 'loader-inline'}>
      <div
        className={`spinner spinner-${size}`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && <div className="loader-label">{label}</div>}
    </div>
  );
}
