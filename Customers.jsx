import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useRole } from '../auth/useRole';
import { useCampaigns } from '../hooks/useCampaigns';
import {
  useCustomers,
  useRegisterCustomer,
  useVerifyOtp,
  useResendOtp
} from '../hooks/useCustomers';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import '../layouts/layout.css';

// ============================================================
//  src/pages/Customers.jsx
//
//  List customers (phone-masked for non-admins) + a 2-step
//  registration flow: enter phone → send OTP → verify OTP.
//
//  ARCHITECTURE RULE RESPECTED HERE:
//  Only hooks are imported — never customers.service.js directly.
//  The masking decision (customers vs customers_masked view) is
//  made inside the service layer, triggered here only by passing
//  `role` into useCustomers().
// ============================================================

export function Customers() {
  const { profile } = useAuth();
  const { role, isAgent } = useRole();
  const navigate = useNavigate();

  const { data: campaigns = [] } = useCampaigns();
  const { data: customers, isLoading, isError } = useCustomers({ role });

  const registerCustomer = useRegisterCustomer();
  const verifyOtp = useVerifyOtp();
  const resendOtp = useResendOtp();

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState('phone'); // 'phone' -> 'otp' -> 'done'
  const [form, setForm] = useState({ phone: '', campaign_id: '', otp: '' });
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [devOtp, setDevOtp] = useState(null); // shown only in dev mode for testing
  const [formError, setFormError] = useState('');

  function resetModal() {
    setStep('phone');
    setForm({ phone: '', campaign_id: '', otp: '' });
    setActiveCustomerId(null);
    setDevOtp(null);
    setFormError('');
    setModalOpen(false);
  }

  async function handleSendOtp() {
    setFormError('');

    if (!form.phone || form.phone.length < 10) {
      setFormError('أدخل رقم هاتف صحيح');
      return;
    }
    if (!form.campaign_id) {
      setFormError('اختر الحملة');
      return;
    }
    if (!navigator.geolocation) {
      setFormError('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const gps_location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const { customer, otp } = await registerCustomer.mutateAsync({
            customer_phone: form.phone,
            agent_id: profile.id,
            campaign_id: form.campaign_id,
            gps_location
          });
          setActiveCustomerId(customer.id);
          setDevOtp(otp); // null in production builds, real value in dev
          setStep('otp');
        } catch (err) {
          setFormError(err.message || 'حدث خطأ في التسجيل');
        }
      },
      () => setFormError('تعذّر تحديد الموقع — فعّل GPS وأعد المحاولة')
    );
  }

  async function handleVerify() {
    setFormError('');
    if (!form.otp || form.otp.length !== 6) {
      setFormError('أدخل الكود المكون من 6 أرقام');
      return;
    }
    try {
      await verifyOtp.mutateAsync({ customerId: activeCustomerId, otp: form.otp });
      setStep('done');
    } catch (err) {
      setFormError(err.message || 'الكود غير صحيح');
    }
  }

  async function handleResend() {
    setFormError('');
    try {
      const { otp } = await resendOtp.mutateAsync({
        customerId: activeCustomerId,
        agentId: profile.id
      });
      setDevOtp(otp);
    } catch (err) {
      setFormError(err.message || 'تعذّر إعادة الإرسال');
    }
  }

  const columns = [
    { key: 'customer_phone', label: 'رقم الهاتف', sortable: true },
    {
      key: 'is_verified',
      label: 'الحالة',
      render: (row) => (
        <span className={`badge ${row.is_verified ? 'badge-success' : 'badge-warning'}`}>
          {row.is_verified ? 'موثّق' : 'في الانتظار'}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'تاريخ التسجيل',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleString('ar-EG')
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/customers/${row.id}`)}>
          عرض
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">العملاء</h1>
          <p className="page-subtitle">
            {role === 'admin' ? 'أرقام الهواتف كاملة' : 'أرقام الهواتف مموهة لحماية الخصوصية'}
          </p>
        </div>
        {isAgent && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            ➕ تسجيل عميل
          </button>
        )}
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={customers}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="لا يوجد عملاء مسجّلون بعد"
          rowKey="id"
        />
      </div>

      <Modal open={modalOpen} onClose={resetModal} title="تسجيل عميل جديد">
        {/* ── Step 1: phone + campaign ── */}
        {step === 'phone' && (
          <>
            <div className="field">
              <label>رقم هاتف العميل</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div className="field">
              <label>الحملة</label>
              <select
                value={form.campaign_id}
                onChange={(e) => setForm((f) => ({ ...f, campaign_id: e.target.value }))}
              >
                <option value="">— اختر الحملة —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {formError && <div className="field-error">⚠️ {formError}</div>}
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleSendOtp}
              disabled={registerCustomer.isPending}
            >
              {registerCustomer.isPending ? 'جارٍ الإرسال...' : '📩 إرسال OTP'}
            </button>
          </>
        )}

        {/* ── Step 2: verify OTP ── */}
        {step === 'otp' && (
          <>
            {devOtp && (
              <div className="alert-banner alert-info">
                🧪 (وضع التطوير فقط) الكود المُرسَل: <strong>{devOtp}</strong>
              </div>
            )}
            <div className="field">
              <label>أدخل الكود المرسل للعميل</label>
              <input
                type="text"
                maxLength={6}
                value={form.otp}
                onChange={(e) => setForm((f) => ({ ...f, otp: e.target.value }))}
                placeholder="123456"
              />
            </div>
            {formError && <div className="field-error">⚠️ {formError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={handleResend} disabled={resendOtp.isPending}>
                إعادة الإرسال
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleVerify}
                disabled={verifyOtp.isPending}
              >
                {verifyOtp.isPending ? 'جارٍ التحقق...' : '✅ تحقق وسجّل'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: done ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>تم تسجيل العميل بنجاح!</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={resetModal}>
              إغلاق
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
