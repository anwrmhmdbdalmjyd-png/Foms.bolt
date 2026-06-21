import { useParams } from 'react-router-dom';
import { useCampaign, useCampaignAgents } from '../hooks/useCampaigns';
import { useTasks } from '../hooks/useTasks';
import { useRole } from '../auth/useRole';
import { DataTable } from '../components/ui/DataTable';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import '../layouts/layout.css';

// ============================================================
//  src/pages/CampaignDetails.jsx
//
//  Single campaign view: budget breakdown, assigned team,
//  and tasks tied to this campaign.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only hooks are imported (useCampaign, useCampaignAgents,
//  useTasks) — never campaigns.service.js or tasks.service.js
//  directly.
// ============================================================

export function CampaignDetails() {
  const { id } = useParams();
  const { isAdmin } = useRole();

  const { data: campaign, isLoading, isError } = useCampaign(id);
  const { data: agents, isLoading: agentsLoading } = useCampaignAgents(id);
  const { data: tasks, isLoading: tasksLoading } = useTasks({ campaignId: id });

  if (isLoading) {
    return <Loader fullScreen label="جارٍ تحميل الحملة..." />;
  }

  if (isError || !campaign) {
    return <EmptyState icon="⚠️" title="تعذّر تحميل الحملة" message="تحقق من الرابط أو صلاحياتك" />;
  }

  const budget = campaign.budgets?.[0];
  const spentPct = budget?.total ? Math.round((budget.spent / budget.total) * 100) : 0;

  const agentColumns = [
    { key: 'full_name', label: 'الاسم', sortable: true },
    { key: 'phone', label: 'الهاتف' },
    {
      key: 'role',
      label: 'الدور',
      render: (row) => (
        <span className={`badge ${row.role === 'supervisor' ? 'badge-warning' : 'badge-info'}`}>
          {row.role === 'supervisor' ? 'مشرف' : 'مندوب'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => (
        <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
          {row.status === 'active' ? 'نشط' : 'موقوف'}
        </span>
      )
    }
  ];

  const taskColumns = [
    { key: 'title', label: 'المهمة', sortable: true },
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
      render: (row) => (row.due_date ? new Date(row.due_date).toLocaleDateString('ar-EG') : '—')
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">
            {campaign.description || 'تفاصيل الحملة والفريق والمهام'}
          </p>
        </div>
        <span className={`badge ${campaign.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
          {campaign.status === 'active' ? 'نشطة' : 'موقوفة'}
        </span>
      </div>

      {/* ── Budget KPIs ──────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{Number(campaign.budget).toLocaleString()} ج</div>
          <div className="kpi-label">الميزانية الإجمالية</div>
        </div>
        <div className="kpi-card" style={budget?.warning_90 ? { borderTopColor: '#c81e1e' } : undefined}>
          <div className="kpi-value">{Number(budget?.spent ?? 0).toLocaleString()} ج</div>
          <div className="kpi-label">المصروف ({spentPct}%)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{Number(budget?.remaining ?? campaign.budget).toLocaleString()} ج</div>
          <div className="kpi-label">المتبقي</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{agents?.length ?? 0}</div>
          <div className="kpi-label">عدد أعضاء الفريق</div>
        </div>
      </div>

      {/* ── Budget warnings ──────────────────────────────────── */}
      {budget?.warning_100 && (
        <div className="alert-banner alert-danger">
          🔴 تم تجاوز الميزانية المخصصة لهذه الحملة بالكامل
        </div>
      )}
      {!budget?.warning_100 && budget?.warning_90 && (
        <div className="alert-banner alert-warning">
          🟠 تم استهلاك أكثر من 90% من الميزانية
        </div>
      )}
      {!budget?.warning_90 && budget?.warning_80 && (
        <div className="alert-banner alert-warning">
          🟡 تم استهلاك أكثر من 80% من الميزانية
        </div>
      )}

      {/* ── Team ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">👥 الفريق المعيّن</div>
        <DataTable columns={agentColumns} data={agents} isLoading={agentsLoading} rowKey="id" />
      </div>

      {/* ── Tasks ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">📋 المهام</div>
        <DataTable columns={taskColumns} data={tasks} isLoading={tasksLoading} rowKey="id" />
      </div>
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
