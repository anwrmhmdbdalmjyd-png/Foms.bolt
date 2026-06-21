import { useState } from 'react';
import { useCampaigns } from '../hooks/useCampaigns';
import {
  useFraudFlags,
  useFraudByCampaign,
  useResolveFraudFlag
} from '../hooks/useFraud';
import { DataTable } from '../components/ui/DataTable';
import '../layouts/layout.css';
import { riskLabel } from './utils/riskLabel';

// ============================================================
//  src/pages/FraudDashboard.jsx
//
//  Monitors suspicious behavior across campaigns/users:
//  - Risk score table of all flagged records
//  - Breakdown of active flags per campaign
//  - One-click resolve action
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only hooks are imported — never fraud.service.js directly.
//
//  REMINDER (from fraud.service.js):
//  fraud_flags rows are expected to be written primarily by a
//  server-side process (Postgres trigger / scheduled Edge
//  Function). This page is a read + resolve surface for those
//  flags — it does not run the detection logic itself.
// ============================================================

export function FraudDashboard() {
  const { data: campaigns = [] } = useCampaigns();
  const [filter, setFilter] = useState('active'); // 'active' | 'resolved' | 'all'

  const { data: flags, isLoading, isError } = useFraudFlags({
    activeOnly: filter === 'active',
    resolvedOnly: filter === 'resolved'
  });

  const { data: campaignRisk = [] } = useFraudByCampaign(campaigns);
  const resolveFlag = useResolveFraudFlag();

  const highRiskCount = (flags ?? []).filter((f) => f.risk_score >= 70).length;

  const columns = [
    { key: 'flagged_user', label: 'المستخدم', render: (row) => row.flagged_user?.full_name || '—' },
    {
      key: 'role',
      label: 'الدور',
      render: (row) => roleLabel(row.flagged_user?.role)
    },
    { key: 'campaign', label: 'الحملة', render: (row) => row.campaign?.name || '—' },
    { key: 'reason', label: 'السبب' },
    {
      key: 'risk_score',
      label: 'نقاط الخطر',
      sortable: true,
      render: (row) => {
        const { label, tone } = riskLabel(row.risk_score);
        return (
          <span className={`badge badge-${tone}`}>
            {row.risk_score} — {label}
          </span>
        );
      }
    },
    {
      key: 'resolved',
      label: 'الحالة',
      render: (row) => (
        <span className={`badge ${row.resolved ? 'badge-success' : 'badge-warning'}`}>
          {row.resolved ? '✅ محلول' : '⏳ نشط'}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'التاريخ',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleString('ar-EG')
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        !row.resolved ? (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => resolveFlag.mutate(row.id)}
            disabled={resolveFlag.isPending}
          >
            ✅ تمييز كمحلول
          </button>
        ) : null
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">كشف الاحتيال</h1>
          <p className="page-subtitle">مراقبة السلوك المشبوه عبر الحملات والمستخدمين</p>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderTopColor: '#c81e1e' }}>
          <div className="kpi-value">{flags?.length ?? 0}</div>
          <div className="kpi-label">
            {filter === 'active' ? 'تنبيهات نشطة' : filter === 'resolved' ? 'تنبيهات محلولة' : 'إجمالي التنبيهات'}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTopColor: '#c81e1e' }}>
          <div className="kpi-value">{highRiskCount}</div>
          <div className="kpi-label">خطر عالي (نقاط ≥ 70)</div>
        </div>
      </div>

      {/* ── Campaign breakdown ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">📊 التنبيهات النشطة حسب الحملة</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {campaignRisk.map((c) => (
            <div key={c.name} style={{ minWidth: 130 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{c.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.count > 0 ? '#c81e1e' : '#111827' }}>
                {c.count}
              </div>
            </div>
          ))}
          {campaignRisk.length === 0 && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>لا توجد بيانات كافية</div>
          )}
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────── */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          نشطة
        </button>
        <button
          className={`filter-tab ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          محلولة
        </button>
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          الكل
        </button>
      </div>

      {/* ── Flags table ────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">🚨 المستخدمون المُعلَّمون</div>
        <DataTable
          columns={columns}
          data={flags}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="لا توجد تنبيهات احتيال — النظام نظيف"
          rowKey="id"
        />
      </div>
    </div>
  );
}

// ── Local helpers (mirror fraud.service.js's getRiskLabel, kept
//    here too since this is the only page that needs the role
//    label translation) ────────────────────────────────────────


function roleLabel(role) {
  if (role === 'admin') return 'أدمن';
  if (role === 'supervisor') return 'مشرف';
  if (role === 'agent') return 'مندوب';
  return '—';
}
