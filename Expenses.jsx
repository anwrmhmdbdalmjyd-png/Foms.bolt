import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useRole } from '../auth/useRole';
import { useCampaigns } from '../hooks/useCampaigns';
import { useExpenses, useSubmitExpense, useReviewExpense } from '../hooks/useExpenses';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Expenses.jsx
//
//  Workflow: supervisor submits (status=pending, receipt
//  required) → admin approves/rejects. Approval automatically
//  syncs budgets.spent via reviewExpense() in the service layer.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only hooks are imported — never expenses.service.js directly.
//  Receipt upload to Storage happens inside submitExpense()
//  in the service, not here.
// ============================================================

export function Expenses() {
  const { profile } = useAuth();
  const { isAdmin, isSupervisor } = useRole();
  const { data: campaigns = [] } = useCampaigns();

  // Supervisors see only their own submissions; admin sees all (RLS + filter)
  const filters = isSupervisor ? { supervisorId: profile?.id } : {};
  const { data: expenses, isLoading, isError } = useExpenses(filters);

  const submitExpense = useSubmitExpense();
  const reviewExpense = useReviewExpense();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ campaign_id: '', amount: '', description: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [formError, setFormError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm({ campaign_id: '', amount: '', description: '' });
    setReceiptFile(null);
    setFormError('');
  }

  async function handleSubmit() {
    setFormError('');

    if (!form.campaign_id) { setFormError('اختر الحملة'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError('أدخل مبلغ صحيح'); return; }
    if (!receiptFile) { setFormError('صورة الفاتورة مطلوبة'); return; }
    if (!navigator.geolocation) { setFormError('المتصفح لا يدعم تحديد الموقع'); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await submitExpense.mutateAsync({
            campaign_id: form.campaign_id,
            supervisor_id: profile.id,
            amount: Number(form.amount),
            description: form.description,
            receiptFile,
            gps_location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          });
          setModalOpen(false);
          resetForm();
        } catch (err) {
          setFormError(err.message || 'حدث خطأ في رفع المصروف');
        }
      },
      () => setFormError('تعذّر تحديد الموقع — فعّل GPS وأعد المحاولة')
    );
  }

  const columns = [
    { key: 'campaign', label: 'الحملة', render: (row) => row.campaign?.name || '—' },
    { key: 'submitter', label: 'المشرف', render: (row) => row.submitter?.full_name || '—' },
    {
      key: 'amount',
      label: 'المبلغ',
      sortable: true,
      render: (row) => `${Number(row.amount).toLocaleString()} ج`
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => (
        <span
          className={`badge ${
            row.status === 'approved'
              ? 'badge-success'
              : row.status === 'rejected'
              ? 'badge-danger'
              : 'badge-warning'
          }`}
        >
          {row.status === 'approved' ? 'معتمد' : row.status === 'rejected' ? 'مرفوض' : 'معلق'}
        </span>
      )
    },
    {
      key: 'receipt_image_url',
      label: 'الفاتورة',
      render: (row) =>
        row.receipt_image_url ? (
          <a href={row.receipt_image_url} target="_blank" rel="noreferrer">
            🖼️ عرض
          </a>
        ) : (
          '—'
        )
    },
    {
      key: 'created_at',
      label: 'التاريخ',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleDateString('ar-EG')
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        isAdmin && row.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-success btn-sm"
              onClick={() => reviewExpense.mutate({ expenseId: row.id, status: 'approved' })}
              disabled={reviewExpense.isPending}
            >
              ✅
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => reviewExpense.mutate({ expenseId: row.id, status: 'rejected' })}
              disabled={reviewExpense.isPending}
            >
              ❌
            </button>
          </div>
        ) : null
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">المصاريف</h1>
          <p className="page-subtitle">
            {isAdmin ? 'اعتماد ومراجعة مصاريف الفريق' : 'رفع ومتابعة مصاريفك الميدانية'}
          </p>
        </div>
        {isSupervisor && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            ➕ رفع مصروف
          </button>
        )}
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={expenses}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="لا توجد مصاريف"
          rowKey="id"
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="رفع مصروف جديد"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setModalOpen(false); resetForm(); }}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitExpense.isPending}>
              {submitExpense.isPending ? 'جارٍ الرفع...' : 'رفع المصروف'}
            </button>
          </>
        }
      >
        <div className="field">
          <label>الحملة</label>
          <select value={form.campaign_id} onChange={(e) => update('campaign_id', e.target.value)}>
            <option value="">— اختر —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>المبلغ</label>
          <input type="number" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
        </div>
        <div className="field">
          <label>الوصف</label>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div className="field">
          <label>صورة الفاتورة <span style={{ color: '#c81e1e' }}>*</span></label>
          <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} />
          {receiptFile && (
            <div style={{ fontSize: 12, color: '#057a55', marginTop: 4 }}>
              ✓ {receiptFile.name}
            </div>
          )}
        </div>
        {formError && <div className="field-error">⚠️ {formError}</div>}
      </Modal>
    </div>
  );
}
