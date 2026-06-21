import { useMemo, useState } from 'react';
import { Loader } from './Loader';
import { EmptyState } from './EmptyState';
import './ui.css';

// ============================================================
//  src/components/ui/DataTable.jsx
//
//  Generic, reusable table used by every list page in the app
//  (Campaigns, Customers, Tasks, Attendance, Expenses, Fraud).
//
//  Bakes in all three states a real-world table needs:
//  - isLoading → <Loader />
//  - isError   → <EmptyState icon="⚠️" />
//  - empty data → <EmptyState />
//
//  Also provides:
//  - Client-side sort (click a sortable column header)
//  - Simple pagination
//
//  columns shape:
//    [{ key, label, sortable?: boolean, render?: (row) => ReactNode }]
//
//  Usage:
//    <DataTable
//      columns={[
//        { key: 'name', label: 'اسم الحملة', sortable: true },
//        { key: 'budget', label: 'الميزانية', render: (row) => `${row.budget} ج` }
//      ]}
//      data={campaigns}
//      isLoading={isLoading}
//      isError={isError}
//      emptyMessage="لا توجد حملات بعد"
//      rowKey="id"
//    />
// ============================================================

export function DataTable({
  columns,
  data,
  isLoading,
  isError,
  errorMessage = 'حدث خطأ في تحميل البيانات',
  emptyMessage = 'لا توجد بيانات لعرضها',
  pageSize = 10,
  rowKey = 'id'
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  // ── Sorting ─────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!data) return [];
    if (!sortKey) return data;

    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  // ── Pagination ──────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil((sorted.length || 0) / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(col) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  // ── States ──────────────────────────────────────────────
  if (isLoading) {
    return <Loader label="جارٍ تحميل البيانات..." />;
  }

  if (isError) {
    return <EmptyState icon="⚠️" title="خطأ" message={errorMessage} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col)}
                className={col.sortable ? 'sortable' : ''}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="data-table-pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            ‹ السابق
          </button>
          <span>
            صفحة {page} من {totalPages}
          </span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            التالي ›
          </button>
        </div>
      )}
    </div>
  );
}
