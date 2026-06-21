import { supabase } from '../lib/supabase';

// ============================================================
//  src/services/fraud.service.js
//
//  ALL Supabase queries related to fraud detection live here.
//
//  Tables used:
//  - fraud_flags (main data — flagged users/records + risk score)
//  - customers   (used by duplicate-phone / GPS-clustering checks)
//  - users       (resolved manually — see FK note below)
//  - campaigns   (resolved manually — see FK note below)
//
//  ARCHITECTURE NOTE:
//  fraud_flags rows are expected to be written primarily by a
//  server-side process (a Postgres trigger or a scheduled Supabase
//  Edge Function) that watches for suspicious patterns continuously.
//  The two heuristic functions below (checkDuplicatePhone,
//  checkGpsClustering) are lightweight CLIENT-TRIGGERED checks —
//  useful for an immediate inline warning at the moment of
//  registration, but they are not a substitute for a real
//  server-side fraud engine in production.
//
//  IMPORTANT — FK naming note:
//  Same approach as the other services: manual join instead of a
//  nested embed, to avoid depending on exact FK constraint names.
//
//  RLS note:
//  - Supervisor → sees fraud flags for their assigned campaigns
//  - Admin      → sees and resolves all fraud flags
// ============================================================


// ── READ ────────────────────────────────────────────────────

/**
 * Fetch fraud flags visible to the current user, sorted by
 * risk score (highest first). Resolves user/campaign names
 * via manual join.
 *
 * @param {object} options
 * @param {string} [options.campaignId] - Filter by campaign
 * @param {boolean} [options.resolvedOnly] - If true, only resolved flags
 * @param {boolean} [options.activeOnly]   - If true, only unresolved flags
 */
export async function fetchFraudFlags({ campaignId, resolvedOnly, activeOnly } = {}) {
  let query = supabase
    .from('fraud_flags')
    .select('*')
    .order('risk_score', { ascending: false });

  if (campaignId)  query = query.eq('campaign_id', campaignId);
  if (resolvedOnly) query = query.eq('resolved', true);
  if (activeOnly)   query = query.eq('resolved', false);

  const { data, error } = await query;
  if (error) throw error;

  const records = data ?? [];
  if (records.length === 0) return [];

  return attachRelatedNames(records);
}

/**
 * Resolve user_id and campaign_id into readable names
 * via manual lookup (not a nested Supabase embed).
 * @param {Array} records - Raw fraud_flags rows
 */
async function attachRelatedNames(records) {
  const userIds     = [...new Set(records.map((r) => r.user_id).filter(Boolean))];
  const campaignIds = [...new Set(records.map((r) => r.campaign_id).filter(Boolean))];

  const [{ data: users }, { data: campaigns }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, full_name, phone, role').in('id', userIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
      : Promise.resolve({ data: [] })
  ]);

  const userMap     = new Map((users ?? []).map((u) => [u.id, u]));
  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c]));

  return records.map((r) => ({
    ...r,
    flagged_user: userMap.get(r.user_id) ?? null,
    campaign:     campaignMap.get(r.campaign_id) ?? null
  }));
}

/**
 * Count active (unresolved) fraud flags.
 * Used for Dashboard KPI card.
 *
 * @param {object} options
 * @param {string[]} [options.campaignIds] - Scope to specific campaigns
 */
export async function countActiveFraudFlags({ campaignIds } = {}) {
  let query = supabase
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('resolved', false);

  if (campaignIds?.length > 0) {
    query = query.in('campaign_id', campaignIds);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Group active fraud flag counts by campaign.
 * Used for FraudDashboard.jsx campaign breakdown view.
 *
 * @param {Array} campaigns - List of { id, name } campaign objects
 */
export async function countFraudFlagsByCampaign(campaigns = []) {
  const { data, error } = await supabase
    .from('fraud_flags')
    .select('campaign_id')
    .eq('resolved', false);

  if (error) throw error;

  const counts = {};
  (data ?? []).forEach((row) => {
    counts[row.campaign_id] = (counts[row.campaign_id] ?? 0) + 1;
  });

  return campaigns.map((c) => ({
    name: c.name,
    count: counts[c.id] ?? 0
  }));
}


// ── WRITE ───────────────────────────────────────────────────

/**
 * Create a fraud flag manually (or via a heuristic check below).
 *
 * @param {object} options
 * @param {string} options.user_id     - Flagged user UUID (required)
 * @param {string} options.campaign_id - Campaign UUID (required)
 * @param {string} options.reason      - Human-readable reason (required)
 * @param {number} [options.risk_score] - 0-100, defaults to 50
 */
export async function createFraudFlag({ user_id, campaign_id, reason, risk_score }) {
  if (!user_id)     throw new Error('معرّف المستخدم مطلوب');
  if (!campaign_id) throw new Error('معرّف الحملة مطلوب');
  if (!reason?.trim()) throw new Error('سبب التنبيه مطلوب');

  const { data, error } = await supabase
    .from('fraud_flags')
    .insert({
      user_id,
      campaign_id,
      reason: reason.trim(),
      risk_score: risk_score ?? 50,
      resolved: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark a fraud flag as resolved.
 * @param {string} flagId - Fraud flag UUID
 */
export async function resolveFraudFlag(flagId) {
  const { data, error } = await supabase
    .from('fraud_flags')
    .update({ resolved: true })
    .eq('id', flagId)
    .select()
    .single();

  if (error) throw error;
  return data;
}


// ── CLIENT-SIDE HEURISTICS ──────────────────────────────────
// Lightweight checks for immediate inline warnings.
// NOT a replacement for a server-side fraud engine.

/**
 * Check if a phone number is already registered more than once
 * within the same campaign (possible duplicate/fraud attempt).
 *
 * @param {string} phone      - Customer phone number
 * @param {string} campaignId - Campaign UUID
 * @returns {boolean} true if duplicate found
 */
export async function checkDuplicatePhone(phone, campaignId) {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('customer_phone', phone)
    .eq('campaign_id', campaignId);

  if (error) throw error;
  return (data ?? []).length > 1;
}

/**
 * Check if an agent has registered an unusually high number of
 * customers from the same approximate GPS point (~50m radius).
 * Suggests the agent may be registering fake customers without
 * actually visiting different locations.
 *
 * @param {string} agentId         - Agent UUID
 * @param {object} gpsLocation     - { lat, lng }
 * @param {number} [thresholdCount=5] - How many matches trigger a flag
 * @returns {boolean} true if clustering detected
 */
export async function checkGpsClustering(agentId, gpsLocation, thresholdCount = 5) {
  if (!gpsLocation) return false;

  const { data, error } = await supabase
    .from('customers')
    .select('id, gps_location')
    .eq('agent_id', agentId);

  if (error) throw error;

  const matches = (data ?? []).filter((row) => {
    if (!row.gps_location) return false;
    const dLat = Math.abs(row.gps_location.lat - gpsLocation.lat);
    const dLng = Math.abs(row.gps_location.lng - gpsLocation.lng);
    return dLat < 0.0005 && dLng < 0.0005; // ~50 meters
  });

  return matches.length >= thresholdCount;
}
}
