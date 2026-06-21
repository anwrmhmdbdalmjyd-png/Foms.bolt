import { supabase } from '../lib/supabase';

// ============================================================
//  src/services/campaigns.service.js
//
//  ALL Supabase queries related to campaigns live here.
//  Pages and components never call supabase directly —
//  they go through hooks, which call these service functions.
//
//  Tables used:
//  - campaigns   (main data)
//  - budgets     (budget tracking per campaign)
//  - assignments (which users belong to which campaign)
//  - users       (agent/supervisor info inside assignments)
//
//  RLS note:
//  - Admin    → sees all campaigns
//  - Supervisor → sees only assigned campaigns (RLS scopes rows)
//  - Agent    → sees only their assigned campaign
//  No role filtering needed here — Postgres handles it.
// ============================================================


// ── READ ────────────────────────────────────────────────────

/**
 * Fetch all campaigns the current user is allowed to see.
 * RLS automatically scopes results by role.
 * Joins budgets as a nested object for budget tracking KPIs.
 */
export async function fetchCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      budgets (
        total,
        spent,
        remaining,
        warning_80,
        warning_90,
        warning_100
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single campaign by ID including its budget.
 * @param {string} id - Campaign UUID
 */
export async function fetchCampaignById(id) {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      budgets (
        total,
        spent,
        remaining,
        warning_80,
        warning_90,
        warning_100
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch all users (agents + supervisors) assigned to a campaign.
 * Uses manual join via assignments → users to avoid FK name issues.
 * @param {string} campaignId - Campaign UUID
 */
export async function fetchCampaignAgents(campaignId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('user_id, assigned_at, users(id, full_name, phone, role, status)')
    .eq('campaign_id', campaignId);

  if (error) throw error;

  // Flatten: move nested users fields to top level
  return (data ?? []).map((row) => ({
    ...row.users,
    assigned_at: row.assigned_at
  }));
}

/**
 * Count total campaigns visible to the current user.
 * Used for Dashboard KPI card.
 */
export async function countCampaigns() {
  const { count, error } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch campaign IDs the current user is assigned to.
 * Used by Dashboard and other services to scope sub-queries.
 * @param {string} userId - Auth user UUID
 */
export async function fetchMyCampaignIds(userId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('campaign_id')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.campaign_id);
}


// ── CREATE ──────────────────────────────────────────────────

/**
 * Create a new campaign and automatically create its budget record.
 * @param {object} payload
 * @param {string} payload.name         - Campaign name (required)
 * @param {number} payload.budget       - Total budget amount (required)
 * @param {string} payload.created_by   - Auth user UUID (required)
 * @param {string} [payload.description]
 * @param {string} [payload.start_date]
 * @param {string} [payload.end_date]
 * @param {string} [payload.status]     - defaults to 'active'
 */
export async function createCampaign(payload) {
  const { name, budget, created_by, description, start_date, end_date, status } = payload;

  // ── Validation ────────────────────────────────────────────
  if (!name?.trim())        throw new Error('اسم الحملة مطلوب');
  if (!budget || budget <= 0) throw new Error('الميزانية يجب أن تكون أكبر من صفر');
  if (!created_by)          throw new Error('معرّف المستخدم مطلوب');

  // ── Insert campaign ───────────────────────────────────────
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      budget,
      start_date: start_date ?? null,
      end_date:   end_date   ?? null,
      status:     status     ?? 'active',
      created_by
    })
    .select()
    .single();

  if (campaignError) throw campaignError;

  // ── Create matching budget record ─────────────────────────
  // Done as a best-effort second insert. If your schema uses a
  // Postgres trigger to auto-create budgets, remove this block.
  const { error: budgetError } = await supabase
    .from('budgets')
    .insert({
      campaign_id: campaign.id,
      total:       budget,
      spent:       0
    });

  if (budgetError) {
    // Budget creation failure is non-fatal for the campaign itself,
    // but log it so it can be diagnosed.
    console.warn('[CampaignsService] Budget record creation failed:', budgetError.message);
  }

  return campaign;
}


// ── UPDATE ──────────────────────────────────────────────────

/**
 * Update specific fields on a campaign.
 * @param {string} id      - Campaign UUID
 * @param {object} updates - Partial campaign fields to update
 */
export async function updateCampaign(id, updates) {
  if (!id) throw new Error('معرّف الحملة مطلوب');

  const { data, error } = await supabase
    .from('campaigns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle a campaign's status between 'active' and 'paused'.
 * @param {string} id            - Campaign UUID
 * @param {'active'|'paused'} currentStatus
 */
export async function toggleCampaignStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  return updateCampaign(id, { status: newStatus });
}


// ── ASSIGNMENTS ─────────────────────────────────────────────

/**
 * Assign a user to a campaign.
 * @param {string} campaignId
 * @param {string} userId
 */
export async function assignUserToCampaign(campaignId, userId) {
  if (!campaignId || !userId) throw new Error('معرّف الحملة والمستخدم مطلوبان');

  const { data, error } = await supabase
    .from('assignments')
    .insert({ campaign_id: campaignId, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a user from a campaign.
 * @param {string} campaignId
 * @param {string} userId
 */
export async function removeUserFromCampaign(campaignId, userId) {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);

  if (error) throw error;
}
