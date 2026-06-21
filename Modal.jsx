import { useEffect } from 'react';
import './ui.css';

// ============================================================
//  src/components/ui/Modal.jsx
//
//  Generic modal dialog used across all "Create X" / "Edit X"
//  forms in the app (campaigns, tasks, expenses, customers...).
//
//  Features:
//  - Closes on Escape key
//  - Closes on click outside the modal box (overlay click)
//  - Optional footer slot for action buttons
//  - Three size presets: sm / md / lg
//
//  Usage:
//    <Modal
//      open={modalOpen}
//      onClose={() => setModalOpen(false)}
//      title="إنشاء حملة جديدة"
//      footer={
//        <>
//          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
//            إلغاء
//          </button>
//          <button className="btn btn-primary" onClick={handleCreate}>
//            إنشاء
//          </button>
//        </>
//      }
//    >
//      <div className="field">
//        <label>اسم الحملة</label>
//        <input value={name} onChange={(e) => setName(e.target.value)} />
//      </div>
//    </Modal>
// ============================================================

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  // ── Close on Escape key ─────────────────────────────────
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        // Only close if the click started on the overlay itself,
        // not on something inside the modal box.
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
