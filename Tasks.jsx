import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useRole } from '../auth/useRole';
import { useCampaigns, useCampaignAgents } from '../hooks/useCampaigns';
import { useTasks, useCreateTask, useUpdateTaskStatus } from '../hooks/useTasks';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Tasks.jsx
//
//  Agent: sees only their own assigned tasks, can mark them
//  completed. Supervisor: creates tasks and assigns them to
//  agents within a chosen campaign.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only hooks are imported — never tasks.service.js directly.
// ============================================================

export function Tasks() {
  const { profile } = useAuth();
  const { isAgent, isSupervisor } = useRole();

  // Agents see only tasks assigned to them; supervisors/admins see all (RLS-scoped)
  const filters = isAgent ? { assignedTo: profile?.id } : {};
  const { data: tasks, isLoading, isError } = useTasks(filters);

  const { data: campaigns = [] } = useCampaigns();
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    campaign_id: '',
    assigned_to: '',
    title: '',
    description: '',
    due_date: ''
  });
  const [formError, setFormError] = useState('');

  // Agent list depends on which campaign is selected in the form
  const { data: agents = [] } = useCampaignAgents(form.campaign_id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm({ campaign_id: '', assigned_to: '', title: '', description: '', due_date: '' });
    setFormError('');
  }

  async function handleCreate() {
    setFormError('');

    if (!form.campaign_id) { setFormError('اختر الحملة'); return; }
    if (!form.assigned_to) { setFormError('اختر المندوب المكلّف'); return; }
    if (!form.title.trim()) { setFormError('عنوان المهمة مطلوب'); return; }

    try {
      await createTask.mutateAsync({ ...form, assigned_by: profile?.id });
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err.message || 'حدث خطأ في إنشاء المهمة');
    }
  }

  const columns = [
    { key: 'title', label: 'المهمة', sortable: true },
    { key: 'campaign', label: 'الحملة', render: (row) => row.campaign?.name || '—' },
    { key: 'assignee', label: 'المكلّف', render: (row) => row.assignee?.full_name || '—' },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => (
        <span
          className={`badge ${
            row.status === 'completed'
              ? 'badge-success'
              : row.status === 'in_progress'
              ? 'badge-info'
              : row.status === 'cancelled'
              ? 'badge-danger'
              : 'badge-gray'
          }`}
        >
          {statusLabel(row.status)}
        </span>
      )
    },
    {
      key: 'due_date',
      label: 'الاستحقاق',
      sortable: true,
      render: (row) => (row.due_date ? new Date(row.due_date).toLocaleDateString('ar-EG') : '—')
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        isAgent && row.status !== 'completed' && row.status !== 'cancelled' ? (
          <button
            className="btn btn-success btn-sm"
            onClick={() => updateStatus.mutate({ taskId: row.id, status: 'completed' })}
            disabled={updateStatus.isPending}
          >
            ✅ إنهاء
          </button>
        ) : null
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">المهام</h1>
          <p className="page-subtitle">
            {isAgent ? 'مهامك الحالية' : 'إدارة وتوزيع مهام الفريق'}
          </p>
        </div>
        {isSupervisor && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            ➕ مهمة جديدة
          </button>
        )}
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={tasks}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="لا توجد مهام بعد"
          rowKey="id"
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="إنشاء مهمة جديدة"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setModalOpen(false); resetForm(); }}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={createTask.isPending}>
              {createTask.isPending ? 'جارٍ الحفظ...' : 'إنشاء'}
            </button>
          </>
        }
      >
        <div className="field">
          <label>الحملة</label>
          <select
            value={form.campaign_id}
            onChange={(e) => update('campaign_id', e.target.value)}
          >
            <option value="">— اختر —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>المندوب المكلّف</label>
          <select
            value={form.assigned_to}
            onChange={(e) => update('assigned_to', e.target.value)}
            disabled={!form.campaign_id}
          >
            <option value="">
              {form.campaign_id ? '— اختر —' : 'اختر الحملة أولاً'}
            </option>
            {agents
              .filter((a) => a.role === 'agent')
              .map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
          </select>
        </div>

        <div className="field">
          <label>عنوان المهمة</label>
          <input value={form.title} onChange={(e) => update('title', e.target.value)} />
        </div>

        <div className="field">
          <label>الوصف</label>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>

        <div className="field">
          <label>تاريخ الاستحقاق</label>
          <input type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} />
        </div>

        {formError && <div className="field-error">⚠️ {formError}</div>}
      </Modal>
    </div>
  );
}

function statusLabel(status) {
  const map = {
    pending: 'معلقة',
    in_progress: 'جارية',
    completed: 'مكتملة',
    cancelled: 'ملغاة'
  };
  return map[status] || status;
}
