import { useParams, useNavigate } from 'react-router-dom';
import { useCustomer } from '../hooks/useCustomers';
import { useRole } from '../auth/useRole';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import '../layouts/layout.css';

// ============================================================
//  src/pages/CustomerDetails.jsx
//
//  Single customer view. Phone number masking is automatic —
//  useCustomer(id, role) reads from `customers_masked` for
//  non-admins and the real `customers` table for admins, so
//  this page never needs to know or care which table was used.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only useCustomer() hook is imported — never customers.service.js
//  directly.
// ============================================================

export function CustomerDetails() {
  const { id } = useParams();
  const { role, isAdmin } = useRole();
  const navigate = useNavigate();

  const { data: customer, isLoading, isError } = useCustomer(id, role);

  if (isLoading) {
    return <Loader fullScreen label="جارٍ تحميل بيانات العميل..." />;
  }

  if (isError || !customer) {
    return (
      <EmptyState
        icon="⚠️"
        title="تعذّر تحميل بيانات العميل"
        message="تحقق من الرابط أو أن العميل ضمن الحملات المسموح لك بالوصول إليها"
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">بيانات العميل</h1>
          <p className="page-subtitle">
            {isAdmin ? 'رقم الهاتف كامل — صلاحية أدمن' : 'رقم الهاتف مموّه لحماية الخصوصية'}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/customers')}>
          ← رجوع للقائمة
        </button>
      </div>

      <div className="card">
        <div className="detail-grid">
          <DetailRow label="رقم الهاتف" value={customer.customer_phone} />

          <DetailRow
            label="حالة التحقق"
            value={
              <span className={`badge ${customer.is_verified ? 'badge-success' : 'badge-warning'}`}>
                {customer.is_verified ? '✅ موثّق' : '⏳ في الانتظار'}
              </span>
            }
          />

          <DetailRow
            label="تاريخ التسجيل"
            value={new Date(customer.created_at).toLocaleString('ar-EG')}
          />

          <DetailRow label="عدد رسائل OTP المُرسَلة" value={`${customer.sms_count ?? 0} / 2`} />

          <DetailRow
            label="الموقع الجغرافي (GPS)"
            value={
              customer.gps_location
                ? `${customer.gps_location.lat?.toFixed?.(5)}, ${customer.gps_location.lng?.toFixed?.(5)}`
                : '— غير متوفر'
            }
          />

          <DetailRow label="معرّف الحملة" value={customer.campaign_id || '—'} />

          {isAdmin && (
            <DetailRow label="معرّف المندوب المسجِّل" value={customer.agent_id || '—'} />
          )}
        </div>

        {!customer.is_verified && (
          <div className="alert-banner alert-warning" style={{ marginTop: 16 }}>
            ⏳ لم يتم التحقق من هذا العميل بعد عبر OTP
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small local component: one label/value row ───────────────
function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}
