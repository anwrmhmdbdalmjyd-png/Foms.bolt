import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useRole } from '../auth/useRole';
import {
  useCampaigns,
  useCreateCampaign,
  useToggleCampaignStatus
} from '../hooks/useCampaigns';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Campaigns.jsx
//
//  List + create campaigns. Admin can create/pause/activate;
//  Supervisor sees only their assigned campaigns (RLS-scoped)
//  and cannot create new ones.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  This page never imports campaigns.service.js directly —
//  only the hooks (useCampaigns, useCreateCampaign, ...).
// ============================================================

export function Campaigns() {
  const { profile } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();

  const { data: campaigns, isLoading, isError } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const toggleStatus = useToggleCampaignStatus();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', budget: '', description: '', start_date: '', end_date: '' });
  const [formError, setFormError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate() {
    setFormError('');
    try {
      await createCampaign.mutateAsync({
        name: form.name.trim(),
        budget: Number(form.budget),
        description: form.description,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        created_by: profile?.id
      });
      setModalOpen(false);
      setForm({ name: '', budget: '', description: '', start_date: '', end_date: '' });
    } catch (err) {
      setFormError(err.message || 'حدث خطأ في إنشاء الحملة');
    }
  }

  const columns = [
    { key: 'name', label: 'اسم الحملة', sortable: true },
    {
      key: 'budget',
      label: 'الميزانية',
      sortable: true,
      render: (row) => `${Number(row.budget ?? 0).toLocaleString()} ج`
    },
    {
      key: 'spent',
      label: 'المصروف',
      render: (row) => `${Number(row.budgets?.[0]?.spent ?? 0).toLocaleString()} ج`
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => (
        <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
          {row.status === 'active' ? 'نشطة' : 'موقوفة'}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'تاريخ الإنشاء',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleDateString('ar-EG')
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/campaigns/${row.id}`)}>
            عرض
          </button>
          {isAdmin && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                toggleStatus.mutate({ id: row.id, currentStatus: row.status })
              }
            >
              {row.status === 'active' ? '⏸️ إيقاف' : '▶️ تفعيل'}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الحملات</h1>
          <p className="page-subtitle">إدارة حملات العمليات الميدانية والميزانيات</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            ➕ حملة جديدة
          </button>
        )}
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={campaigns}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="لا توجد حملات بعد"
          rowKey="id"
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="إنشاء حملة جديدة"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={createCampaign.isPending}
            >
              {createCampaign.isPending ? 'جارٍ الحفظ...' : 'إنشاء الحملة'}
            </button>
          </>
        }
      >
        <div className="field">
          <label>اسم الحملة</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div className="field">
          <label>الميزانية الإجمالية</label>
          <input type="number" value={form.budget} onChange={(e) => update('budget', e.target.value)} />
        </div>
        <div className="field">
          <label>الوصف</label>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>تاريخ البداية</label>
            <input type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
          </div>
          <div className="field">
            <label>تاريخ النهاية</label>
            <input type="date" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} />
          </div>
        </div>
        {formError && <div className="field-error">⚠️ {formError}</div>}
      </Modal>
    </div>
  );
}
