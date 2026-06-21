import { useAuth } from '../auth/useAuth';
import { useRole } from '../auth/useRole';
import { useCampaigns, useCampaignsCount } from '../hooks/useCampaigns';
import { useCustomersTodayCount, useCustomerGrowth } from '../hooks/useCustomers';
import { useAgentsCount, useAttendanceRate } from '../hooks/useAttendance';
import { useApprovedExpensesTotal } from '../hooks/useExpenses';
import { useFraudCount } from '../hooks/useFraud';
import { KPIChart } from '../components/charts/KPIChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { Loader } from '../components/ui/Loader';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Dashboard.jsx
//
//  Role-aware KPI dashboard.
//  - Admin      → KPIs/charts scoped to ALL campaigns
//  - Supervisor → KPIs/charts scoped to their assigned campaigns
//  - Agent      → simplified personal view (own customers/attendance)
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  This page calls ONLY hooks (useCampaigns, useCustomersTodayCount,
//  etc.) — never supabase directly. Every one of those hooks wraps
//  a function from the corresponding *.service.js file.
// ============================================================

export function Dashboard() {
  const { profile } = useAuth();
  const { isAdmin, isAgent } = useRole();

  // ── Scope: which campaigns' data this dashboard should reflect ──
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const campaignIds = campaigns.map((c) => c.id);
  const scopedIds = isAdmin ? undefined : campaignIds; // undefined = no filter (admin sees all)

  // ── KPI: Total Campaigns ──────────────────────────────────
  const { data: totalCampaigns = 0, isLoading: campaignsCountLoading } = useCampaignsCount();

  // ── KPI: Customers Today ──────────────────────────────────
  const { data: customersToday = 0, isLoading: customersLoading } =
    useCustomersTodayCount(scopedIds);

  // ── KPI: Attendance Rate ──────────────────────────────────
  const { data: totalAgents = 0, isLoading: agentsCountLoading } = useAgentsCount(scopedIds);
  const { data: attendanceRate = 0, isLoading: attendanceLoading } = useAttendanceRate({
    campaignIds: scopedIds,
    totalAgents
  });

  // ── KPI: Total Approved Expenses ──────────────────────────
  const { data: expensesTotal = 0, isLoading: expensesLoading } =
    useApprovedExpensesTotal(campaignIds);

  // ── KPI: Fraud Alerts ──────────────────────────────────────
  const { data: fraudCount = 0, isLoading: fraudLoading } = useFraudCount(scopedIds);

  // ── Chart: Customer growth (last 14 days) ─────────────────
  const { data: growthData = [], isLoading: growthLoading } = useCustomerGrowth({
    campaignIds: scopedIds,
    days: 14
  });

  // ── Chart: Campaign spend (bar + pie) ─────────────────────
  const campaignSpend = campaigns.map((c) => ({
    name: c.name,
    spent: Number(c.budgets?.[0]?.spent ?? 0)
  }));

  // ── Chart: Conversion funnel (estimated from today's count) ──
  const funnelStages = [
    { label: 'محتمل',        value: customersToday * 3, color: '#1a56db' },
    { label: 'تم التواصل',   value: customersToday * 2, color: '#7c3aed' },
    { label: 'موثّق (OTP)',  value: customersToday,     color: '#057a55' }
  ];

  const isInitialLoading =
    campaignsLoading || campaignsCountLoading || customersLoading || agentsCountLoading;

  if (isInitialLoading) {
    return <Loader fullScreen label="جارٍ تحميل لوحة التحكم..." />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">لوحة التحكم</h1>
          <p className="page-subtitle">
            مرحباً {profile?.full_name} —{' '}
            {isAgent ? 'إحصائياتك الشخصية' : 'نظرة عامة على العمليات الميدانية'}
          </p>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="kpi-grid">
        <KpiCard label="إجمالي الحملات" value={totalCampaigns} loading={campaignsCountLoading} />

        <KpiCard
          label="عملاء اليوم"
          value={customersToday}
          loading={customersLoading}
        />

        <KpiCard
          label="نسبة الحضور"
          value={`${attendanceRate}%`}
          loading={attendanceLoading}
        />

        <KpiCard
          label="إجمالي المصاريف المعتمدة"
          value={`${expensesTotal.toLocaleString()} ج`}
          loading={expensesLoading}
        />

        {!isAgent && (
          <KpiCard
            label="تنبيهات احتيال"
            value={fraudCount}
            loading={fraudLoading}
            tone="danger"
          />
        )}
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="charts-grid">
        <KPIChart
          kind="line"
          data={growthData}
          xKey="date"
          yKey="count"
          title="نمو تسجيل العملاء — آخر 14 يوم"
        />

        {!isAgent && (
          <KPIChart
            kind="bar"
            data={campaignSpend}
            xKey="name"
            yKey="spent"
            title="إنفاق الحملات"
          />
        )}
      </div>

      <div className="charts-grid">
        <FunnelChart stages={funnelStages} title="تحويل العملاء (تقديري)" />

        {!isAgent && (
          <KPIChart
            kind="pie"
            data={campaignSpend}
            xKey="name"
            yKey="spent"
            title="توزيع الإنفاق بين الحملات"
          />
        )}
      </div>
    </div>
  );
}

// ── Small local component: one KPI card ──────────────────────
function KpiCard({ label, value, loading, tone }) {
  return (
    <div
      className="kpi-card"
      style={tone === 'danger' ? { borderTopColor: '#c81e1e' } : undefined}
    >
      <div className="kpi-value">{loading ? '—' : value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
