import { supabase } from '../lib/supabase';

// ============================================================
//  src/services/attendance.service.js
//
//  ALL Supabase queries related to attendance live here.
//
//  Tables used:
//  - attendance  (main data — GPS, selfie, verification status)
//  - assignments (used to count real agents for attendance rate)
//  - users       (resolved manually — see note below)
//
//  IMPORTANT — FK naming note:
//  `attendance` has TWO foreign keys into `users`:
//    - user_id        (the agent checking in)
//    - supervisor_id  (the supervisor who verifies)
//  A nested `.select('*, users(...)')` would be ambiguous to
//  PostgREST in this situation, and a `table!constraint_fkey(...)`
//  hint only works if you know the exact constraint name Postgres
//  generated. To avoid both problems, this service resolves
//  user/campaign names with a manual second query + in-memory map
//  instead of a nested embed. This works regardless of how your
//  FK constraints were named.
//
//  RLS note:
//  - Agent      → sees only their own attendance records
//  - Supervisor → sees attendance for their assigned campaigns
//  - Admin      → sees everything
// ============================================================


// ── READ ────────────────────────────────────────────────────

/**
 * Fetch attendance records visible to the current user.
 * Resolves agent name, supervisor name, and campaign name via
 * a manual join (see FK naming note above).
 *
 * @param {object} options
 * @param {string} [options.campaignId] - Filter by campaign
 * @param {string} [options.userId]     - Filter by agent (their own records)
 */
export async function fetchAttendance({ campaignId, userId } = {}) {
  let query = supabase
    .from('attendance')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (userId)     query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;

  const records = data ?? [];
  if (records.length === 0) return [];

  return attachRelatedNames(records);
}

/**
 * Resolve user_id, supervisor_id, and campaign_id into readable
 * names via a manual lookup (not a nested Supabase embed).
 * @param {Array} records - Raw attendance rows
 */
async function attachRelatedNames(records) {
  const userIds = [
    ...new Set(
      records.flatMap((r) => [r.user_id, r.supervisor_id]).filter(Boolean)
    )
  ];
  const campaignIds = [...new Set(records.map((r) => r.campaign_id).filter(Boolean))];

  const [{ data: users }, { data: campaigns }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, full_name, phone').in('id', userIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
      : Promise.resolve({ data: [] })
  ]);

  const userMap     = new Map((users ?? []).map((u) => [u.id, u]));
  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c]));

  return records.map((r) => ({
    ...r,
    agent:      userMap.get(r.user_id) ?? null,
    supervisor: userMap.get(r.supervisor_id) ?? null,
    campaign:   campaignMap.get(r.campaign_id) ?? null
  }));
}

/**
 * Check if the given user has already checked in today.
 * Used to disable the "Check In" button after first check-in.
 * @param {string} userId - Agent UUID
 */
export async function fetchTodayCheckIn(userId) {
  if (!userId) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Calculate today's attendance rate as a percentage.
 * Used for Dashboard KPI card.
 *
 * @param {object} options
 * @param {string[]} [options.campaignIds] - Scope to specific campaigns
 * @param {number}   options.totalAgents   - Real agent headcount (see countAgents below)
 */
export async function fetchAttendanceRate({ campaignIds, totalAgents } = {}) {
  if (!totalAgents || totalAgents === 0) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let query = supabase
    .from('attendance')
    .select('user_id')
    .gte('created_at', startOfDay.toISOString());

  if (campaignIds?.length > 0) {
    query = query.in('campaign_id', campaignIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const uniqueCheckedIn = new Set((data ?? []).map((r) => r.user_id));
  return Math.round((uniqueCheckedIn.size / totalAgents) * 100);
}

/**
 * Count real agents assigned to given campaigns, via the
 * `assignments` table — NOT a fake `agent_count` column
 * (campaigns has no such column).
 *
 * @param {string[]} [campaignIds] - If omitted, counts ALL agents (admin view)
 */
export async function countAgents(campaignIds) {
  let query = supabase
    .from('assignments')
    .select('user_id, users(role)');

  if (campaignIds?.length > 0) {
    query = query.in('campaign_id', campaignIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const agentIds = new Set(
    (data ?? [])
      .filter((row) => row.users?.role === 'agent')
      .map((row) => row.user_id)
  );

  return agentIds.size;
}


// ── CREATE ──────────────────────────────────────────────────

/**
 * Register a new attendance check-in.
 * Prevents duplicate check-ins on the same day.
 *
 * @param {object} options
 * @param {string} options.user_id            - Agent UUID (required)
 * @param {string} options.campaign_id        - Campaign UUID (required)
 * @param {string} [options.supervisor_id]    - Supervisor UUID
 * @param {object} [options.gps_location]     - { lat, lng }
 * @param {string} [options.selfie_image_url] - Storage URL of selfie
 */
export async function registerAttendance({
  user_id,
  campaign_id,
  supervisor_id,
  gps_location,
  selfie_image_url
}) {
  if (!user_id)     throw new Error('معرّف المندوب مطلوب');
  if (!campaign_id) throw new Error('معرّف الحملة مطلوب');

  // Prevent duplicate check-in
  const existing = await fetchTodayCheckIn(user_id);
  if (existing) {
    throw new Error('تم تسجيل الحضور اليوم مسبقاً');
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      user_id,
      campaign_id,
      supervisor_id:     supervisor_id ?? null,
      gps_location:      gps_location ?? null,
      selfie_image_url:  selfie_image_url ?? null,
      verification_status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}


// ── UPDATE ──────────────────────────────────────────────────

/**
 * Supervisor verifies or flags an attendance record.
 *
 * @param {string} attendanceId - Attendance UUID
 * @param {'verified'|'rejected'|'flagged'} status
 */
export async function verifyAttendance(attendanceId, status) {
  if (!['verified', 'rejected', 'flagged'].includes(status)) {
    throw new Error('حالة غير صالحة');
  }

  const { data, error } = await supabase
    .from('attendance')
    .update({ verification_status: status })
    .eq('id', attendanceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
