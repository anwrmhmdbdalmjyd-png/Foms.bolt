import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useRole } from '../auth/useRole';
import { useCampaigns } from '../hooks/useCampaigns';
import {
  useAttendance,
  useTodayCheckIn,
  useRegisterAttendance,
  useVerifyAttendance
} from '../hooks/useAttendance';
import { DataTable } from '../components/ui/DataTable';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Attendance.jsx
//
//  Agent: checks in once per day (GPS captured automatically;
//  selfie upload is a drop-in addition — see note below).
//  Supervisor: reviews today's check-ins and verifies/flags them.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only hooks are imported — never attendance.service.js directly.
// ============================================================

export function Attendance() {
  const { profile } = useAuth();
  const { isAgent, isSupervisor } = useRole();
  const { data: campaigns = [] } = useCampaigns();

  // Agents see only their own records; supervisors/admins see all (RLS-scoped)
  const filters = isAgent ? { userId: profile?.id } : {};
  const { data: attendance, isLoading, isError } = useAttendance(filters);

  const { data: todayCheckIn } = useTodayCheckIn(profile?.id);
  const registerAttendance = useRegisterAttendance();
  const verifyAttendance = useVerifyAttendance();

  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState('');

  async function handleCheckIn() {
    setError('');

    if (!campaignId) {
      setError('اختر الحملة أولاً');
      return;
    }
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await registerAttendance.mutateAsync({
            user_id: profile.id,
            campaign_id: campaignId,
            supervisor_id: null,
            gps_location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            // selfie_image_url: null — see note below this component
            selfie_image_url: null
          });
        } catch (err) {
          setError(err.message || 'حدث خطأ في تسجيل الحضور');
        }
      },
      () => setError('تعذّر تحديد الموقع — فعّل GPS وأعد المحاولة')
    );
  }

  const columns = [
    { key: 'agent', label: 'المندوب', render: (row) => row.agent?.full_name || '—' },
    { key: 'campaign', label: 'الحملة', render: (row) => row.campaign?.name || '—' },
    {
      key: 'gps_location',
      label: 'الموقع',
      render: (row) =>
        row.gps_location
          ? `${row.gps_location.lat?.toFixed?.(4)}, ${row.gps_location.lng?.toFixed?.(4)}`
          : '—'
    },
    {
      key: 'selfie_image_url',
      label: 'Selfie',
      render: (row) =>
        row.selfie_image_url ? (
          <a href={row.selfie_image_url} target="_blank" rel="noreferrer">📷 عرض</a>
        ) : (
          '—'
        )
    },
    {
      key: 'verification_status',
      label: 'الحالة',
      render: (row) => (
        <span
          className={`badge ${
            row.verification_status === 'verified'
              ? 'badge-success'
              : row.verification_status === 'rejected'
              ? 'badge-danger'
              : row.verification_status === 'flagged'
              ? 'badge-warning'
              : 'badge-gray'
          }`}
        >
          {statusLabel(row.verification_status)}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'الوقت',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleString('ar-EG')
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        isSupervisor && row.verification_status === 'pending' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-success btn-sm"
              onClick={() => verifyAttendance.mutate({ attendanceId: row.id, status: 'verified' })}
              disabled={verifyAttendance.isPending}
            >
              ✅
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => verifyAttendance.mutate({ attendanceId: row.id, status: 'flagged' })}
              disabled={verifyAttendance.isPending}
            >
              🚩
            </button>
          </div>
        ) : null
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الحضور</h1>
          <p className="page-subtitle">
            {isAgent ? 'سجل حضورك اليومي' : 'مراقبة واعتماد حضور الفريق'}
          </p>
        </div>
      </div>

      {isAgent && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">✅ تسجيل الحضور</div>

          {todayCheckIn ? (
            <span className="badge badge-success">تم تسجيل حضورك اليوم</span>
          ) : (
            <>
              <div className="field">
                <label>الحملة</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">— اختر الحملة —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {error && <div className="field-error">⚠️ {error}</div>}
              <button
                className="btn btn-primary"
                onClick={handleCheckIn}
                disabled={registerAttendance.isPending}
              >
                {registerAttendance.isPending ? 'جارٍ التسجيل...' : '📍 تسجيل الحضور الآن'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="card">
        <DataTable
          columns={columns}
          data={attendance}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="لا توجد سجلات حضور"
          rowKey="id"
        />
      </div>
    </div>
  );
}

function statusLabel(status) {
  const map = {
    pending: 'معلّق',
    verified: 'معتمد',
    rejected: 'مرفوض',
    flagged: 'مُعلَّم'
  };
  return map[status] || status || 'معلّق';
}
