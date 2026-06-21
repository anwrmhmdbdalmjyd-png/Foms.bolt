import { EmptyState } from '../ui/EmptyState';
import './charts.css';

// ============================================================
//  src/components/charts/FunnelChart.jsx
//
//  Recharts has no first-class funnel chart in this version,
//  so this is a lightweight, dependency-free funnel built with
//  plain div bars. Visually equivalent for a small number of
//  stages (e.g. لمحتمل → تم التواصل → موثّق).
//
//  stages shape:
//    [{ label, value, color? }]
//
//  Usage:
//    <FunnelChart
//      title="تحويل العملاء"
//      stages={[
//        { label: 'محتمل',       value: 120, color: '#1a56db' },
//        { label: 'تم التواصل',  value: 80,  color: '#7c3aed' },
//        { label: 'موثّق (OTP)', value: 40,  color: '#057a55' }
//      ]}
//    />
// ============================================================

export function FunnelChart({ stages, title }) {
  if (!stages || stages.length === 0) {
    return (
      <div className="chart-card">
        {title && <div className="chart-title">{title}</div>}
        <EmptyState title="لا توجد بيانات كافية" />
      </div>
    );
  }

  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="chart-card">
      {title && <div className="chart-title">{title}</div>}

      <div className="funnel-wrap">
        {stages.map((stage, idx) => {
          const widthPct = Math.max(8, Math.round((stage.value / max) * 100));
          const prevValue = idx > 0 ? stages[idx - 1].value : stage.value;
          const conversionPct =
            idx > 0 && prevValue > 0
              ? Math.round((stage.value / prevValue) * 100)
              : 100;

          return (
            <div className="funnel-row" key={stage.label}>
              <div className="funnel-label">{stage.label}</div>
              <div className="funnel-bar-track">
                <div
                  className="funnel-bar-fill"
                  style={{ width: `${widthPct}%`, background: stage.color || '#1a56db' }}
                >
                  {stage.value}
                </div>
              </div>
              {idx > 0 && <div className="funnel-conversion">{conversionPct}%</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
