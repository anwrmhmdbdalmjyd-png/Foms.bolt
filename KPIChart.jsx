import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { EmptyState } from '../ui/EmptyState';
import './charts.css';

// ============================================================
//  src/components/charts/KPIChart.jsx
//
//  One component, three chart "kinds" — keeps Dashboard.jsx
//  declarative: <KPIChart kind="line" data={...} ... />
//  instead of importing and configuring Recharts directly
//  inside page components.
//
//  Usage:
//    <KPIChart kind="line" data={growthData} xKey="date" yKey="count" title="نمو العملاء" />
//    <KPIChart kind="bar"  data={campaignSpend} xKey="name" yKey="spent" title="إنفاق الحملات" />
//    <KPIChart kind="pie"  data={campaignSpend} xKey="name" yKey="spent" title="توزيع الإنفاق" />
// ============================================================

const COLORS = ['#1a56db', '#057a55', '#d97706', '#c81e1e', '#7c3aed', '#0891b2'];

export function KPIChart({ kind, data, xKey, yKey, title, height = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card">
        {title && <div className="chart-title">{title}</div>}
        <EmptyState title="لا توجد بيانات كافية" />
      </div>
    );
  }

  return (
    <div className="chart-card">
      {title && <div className="chart-title">{title}</div>}

      <ResponsiveContainer width="100%" height={height}>
        {kind === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#1a56db"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        ) : kind === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey={yKey} fill="#1a56db" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={(entry) => entry[xKey]}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
