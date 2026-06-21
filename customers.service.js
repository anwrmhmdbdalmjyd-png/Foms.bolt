import { supabase } from '../lib/supabase';

// ============================================================
//  src/services/customers.service.js
//
//  ALL Supabase queries related to customers live here.
//
//  Tables used:
//  - customers        (main data)
//  - customers_masked (view — masks customer_phone for non-admins)
//  - notifications    (used to store OTP temporarily)
//
//  Phone masking strategy:
//  - Admin      → queries `customers` directly (full phone number)
//  - Supervisor → queries `customers_masked` (010*****678)
//  - Agent      → queries `customers_masked` (010*****678)
//
//  OTP strategy:
//  - Generated client-side (6 digits, valid 5 minutes)
//  - Stored temporarily in `notifications` table
//  - Max 2 OTP sends per phone per day
//  - In production: replace console.log with real SMS provider
//    via a Supabase Edge Function
//
//  RLS note:
//  - Agent sees only their own registered customers
//  - Supervisor sees customers in their assigned campaigns
//  - Admin sees everything
// ============================================================


// ── READ ────────────────────────────────────────────────────

/**
 * Fetch customers visible to the current user.
 * Automatically selects masked or unmasked view based on role.
 *
 * @param {object}   options
 * @param {string}   options.role        - 'admin' | 'supervisor' | 'agent'
 * @param {string}   [options.campaignId] - Filter by campaign
 * @param {string}   [options.agentId]    - Filter by agent (admin/supervisor use)
 */
export async function fetchCustomers({ role, campaignId, agentId } = {}) {
  // Admins see real phone numbers; everyone else sees masked view
  const table = role === 'admin' ? 'customers' : 'customers_masked';

  let query = supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (agentId)    query = query.eq('agent_id', agentId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single customer by ID.
 * @param {string} id   - Customer UUID
 * @param {string} role - Caller's role (determines masking)
 */
export async function fetchCustomerById(id, role) {
  const table = role === 'admin' ? 'customers' : 'customers_masked';

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Count customers registered today.
 * Used for Dashboard KPI card.
 *
 * @param {object}   options
 * @param {string[]} [options.campaignIds] - Scope to specific campaigns
 */
export async function countCustomersToday({ campaignIds } = {}) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let query = supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString());

  if (campaignIds?.length > 0) {
    query = query.in('campaign_id', campaignIds);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch customer growth data for the last N days.
 * Used for Dashboard line chart.
 *
 * @param {object}   options
 * @param {string[]} [options.campaignIds] - Scope to specific campaigns
 * @param {number}   [options.days=14]     - How many days back to look
 * @returns {Array<{ date: string, count: number }>}
 */
export async function fetchCustomerGrowth({ campaignIds, days = 14 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = supabase
    .from('customers')
    .select('created_at')
    .gte('created_at', since.toISOString());

  if (campaignIds?.length > 0) {
    query = query.in('campaign_id', campaignIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Build a date-bucketed series so the chart always shows
  // every day in the range, even days with zero registrations
  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i + 1);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  (data ?? []).forEach((row) => {
    const day = row.created_at.slice(0, 10);
    if (day in buckets) buckets[day] += 1;
  });

  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}


// ── OTP ─────────────────────────────────────────────────────

/**
 * Check how many OTPs have been sent to a phone today.
 * Enforces the 2-OTP-per-day limit.
 *
 * @param {string} phone   - Customer phone number
 * @param {string} agentId - Agent UUID (scopes the check)
 */
async function getOtpCountToday(phone, agentId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('title', `OTP_${phone}`)
    .eq('user_id', agentId)
    .gte('created_at', startOfDay.toISOString());

  if (error) throw error;
  return count ?? 0;
}

/**
 * Register a new customer and send their OTP.
 * Enforces: max 2 OTP sends per phone per day.
 *
 * @param {object} options
 * @param {string} options.customer_phone - Customer phone number (required)
 * @param {string} options.agent_id       - Agent UUID (required)
 * @param {string} options.campaign_id    - Campaign UUID (required)
 * @param {object} [options.gps_location] - { lat, lng } object
 * @returns {{ customer, otp }} — otp exposed in DEV only for testing
 */
export async function registerCustomer({
  customer_phone,
  agent_id,
  campaign_id,
  gps_location
}) {
  // ── Validation ────────────────────────────────────────────
  if (!customer_phone?.trim()) throw new Error('رقم هاتف العميل مطلوب');
  if (!agent_id)               throw new Error('معرّف المندوب مطلوب');
  if (!campaign_id)            throw new Error('معرّف الحملة مطلوب');

  // ── OTP daily limit check ─────────────────────────────────
  const otpCount = await getOtpCountToday(customer_phone, agent_id);
  if (otpCount >= 2) {
    throw new Error(
      'تم الوصول للحد الأقصى من رسائل OTP (2 رسائل يومياً) لهذا الرقم'
    );
  }

  // ── Check for duplicate in same campaign ──────────────────
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('customer_phone', customer_phone)
    .eq('campaign_id', campaign_id)
    .maybeSingle();

  if (existing) {
    throw new Error('هذا الرقم مسجّل مسبقاً في هذه الحملة');
  }

  // ── Generate OTP ──────────────────────────────────────────
  const otp        = String(Math.floor(100000 + Math.random() * 900000));
  const otp_expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // ── Insert customer row ───────────────────────────────────
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      customer_phone: customer_phone.trim(),
      agent_id,
      campaign_id,
      gps_location:   gps_location ?? null,
      otp_code:       otp,
      otp_expiry,
      is_verified:    false,
      sms_count:      1
    })
    .select()
    .single();

  if (customerError) throw customerError;

  // ── Log OTP send in notifications (for daily-limit tracking) ─
  await supabase
    .from('notifications')
    .insert({
      user_id: agent_id,
      title:   `OTP_${customer_phone}`,
      body:    JSON.stringify({ otp, expiry: otp_expiry }),
      type:    'otp'
    });

  // ── In production: call Supabase Edge Function for real SMS ──
  // await supabase.functions.invoke('send-otp-sms', {
  //   body: { phone: customer_phone, otp }
  // });

  if (import.meta.env.DEV) {
    console.info(`[FOMS DEV] OTP for ${customer_phone}: ${otp}`);
  }

  return { customer, otp: import.meta.env.DEV ? otp : null };
}

/**
 * Resend OTP to an existing customer.
 * Enforces the 2-OTP-per-day limit.
 *
 * @param {string} customerId - Customer UUID
 * @param {string} agentId    - Agent UUID
 */
export async function resendOtp(customerId, agentId) {
  // Fetch customer to get their phone
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('id, customer_phone, sms_count')
    .eq('id', customerId)
    .single();

  if (fetchError) throw fetchError;

  // Enforce daily limit
  const otpCount = await getOtpCountToday(customer.customer_phone, agentId);
  if (otpCount >= 2) {
    throw new Error(
      'تم الوصول للحد الأقصى من رسائل OTP (2 رسائل يومياً) لهذا الرقم'
    );
  }

  // Generate new OTP
  const otp        = String(Math.floor(100000 + Math.random() * 900000));
  const otp_expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Update customer row with new OTP
  const { data: updated, error: updateError } = await supabase
    .from('customers')
    .update({
      otp_code:  otp,
      otp_expiry,
      sms_count: (customer.sms_count ?? 0) + 1
    })
    .eq('id', customerId)
    .select()
    .single();

  if (updateError) throw updateError;

  // Log in notifications for daily-limit tracking
  await supabase
    .from('notifications')
    .insert({
      user_id: agentId,
      title:   `OTP_${customer.customer_phone}`,
      body:    JSON.stringify({ otp, expiry: otp_expiry }),
      type:    'otp'
    });

  if (import.meta.env.DEV) {
    console.info(`[FOMS DEV] Resent OTP for ${customer.customer_phone}: ${otp}`);
  }

  return { customer: updated, otp: import.meta.env.DEV ? otp : null };
}

/**
 * Verify the OTP entered by the customer.
 * Marks customer as verified on success.
 *
 * @param {string} customerId  - Customer UUID
 * @param {string} enteredOtp  - 6-digit string entered by agent
 */
export async function verifyOtp(customerId, enteredOtp) {
  // Fetch stored OTP and expiry
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('id, otp_code, otp_expiry, is_verified')
    .eq('id', customerId)
    .single();

  if (fetchError) throw fetchError;

  // Already verified
  if (customer.is_verified) {
    throw new Error('تم التحقق من هذا العميل مسبقاً');
  }

  // OTP missing
  if (!customer.otp_code) {
    throw new Error('لم يتم إرسال OTP لهذا العميل بعد');
  }

  // Expired
  if (new Date(customer.otp_expiry) < new Date()) {
    throw new Error('انتهت صلاحية OTP — اطلب من المندوب إعادة الإرسال');
  }

  // Wrong code
  if (customer.otp_code !== String(enteredOtp).trim()) {
    throw new Error('الكود غير صحيح. تحقق من الرقم وأعد المحاولة');
  }

  // Mark as verified
  const { data: verified, error: updateError } = await supabase
    .from('customers')
    .update({ is_verified: true })
    .eq('id', customerId)
    .select()
    .single();

  if (updateError) throw updateError;
  return verified;
}
