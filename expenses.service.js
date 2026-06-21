import { supabase } from '../lib/supabase';

// ============================================================
//  src/services/expenses.service.js
//
//  ALL Supabase queries related to expenses live here.
//
//  Tables used:
//  - expenses  (main data — amount, receipt, status)
//  - budgets   (kept in sync when an expense is approved)
//  - users     (resolved manually — see FK note below)
//  - campaigns (resolved manually — see FK note below)
//
//  Workflow states: 'pending' → 'approved' | 'rejected'
//  - Supervisor submits expenses (status = pending)
//  - Admin approves or rejects
//  - On approval, budgets.spent is incremented automatically
//
//  IMPORTANT — FK naming note:
//  Same issue as attendance.service.js: relying on a nested
//  `.select('*, users(...)')` or a guessed `table!constraint_fkey`
//  hint is fragile because it depends on exact constraint names
//  in your database. This service resolves submitter/campaign
//  names via a manual second query instead — works regardless
//  of how your FK constraints were named.
//
//  RLS note:
//  - Supervisor → sees only expenses they submitted
//  - Admin      → sees and approves/rejects all expenses
// ============================================================


// ── READ ────────────────────────────────────────────────────

/**
 * Fetch expenses visible to the current user.
 * Resolves submitter name and campaign name via manual join.
 *
 * @param {object} options
 * @param {string} [options.campaignId]   - Filter by campaign
 * @param {string} [options.status]       - 'pending' | 'approved' | 'rejected'
 * @param {string} [options.supervisorId] - Filter by submitter (their own)
 */
export async function fetchExpenses({ campaignId, status, supervisorId } = {}) {
  let query = supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId)   query = query.eq('campaign_id', campaignId);
  if (status)       query = query.eq('status', status);
  if (supervisorId) query = query.eq('supervisor_id', supervisorId);

  const { data, error } = await query;
  if (error) throw error;

  const records = data ?? [];
  if (records.length === 0) return [];

  return attachRelatedNames(records);
}

/**
 * Resolve supervisor_id and campaign_id into readable names
 * via manual lookup (not a nested Supabase embed).
 * @param {Array} records - Raw expense rows
 */
async function attachRelatedNames(records) {
  const supervisorIds = [...new Set(records.map((r) => r.supervisor_id).filter(Boolean))];
  const campaignIds   = [...new Set(records.map((r) => r.campaign_id).filter(Boolean))];

  const [{ data: users }, { data: campaigns }] = await Promise.all([
    supervisorIds.length
      ? supabase.from('users').select('id, full_name').in('id', supervisorIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
      : Promise.resolve({ data: [] })
  ]);

  const userMap     = new Map((users ?? []).map((u) => [u.id, u]));
  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c]));

  return records.map((r) => ({
    ...r,
    submitter: userMap.get(r.supervisor_id) ?? null,
    campaign:  campaignMap.get(r.campaign_id) ?? null
  }));
}

/**
 * Sum total APPROVED expenses across given campaigns.
 * Used for Dashboard KPI card.
 * @param {string[]} campaignIds
 */
export async function sumApprovedExpenses(campaignIds = []) {
  if (campaignIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('expenses')
    .select('amount')
    .in('campaign_id', campaignIds)
    .eq('status', 'approved');

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}


// ── CREATE ──────────────────────────────────────────────────

/**
 * Submit a new expense with a receipt image upload to Storage.
 *
 * @param {object} options
 * @param {string} options.campaign_id   - Campaign UUID (required)
 * @param {string} options.supervisor_id - Submitter UUID (required)
 * @param {number} options.amount        - Expense amount (required, > 0)
 * @param {string} [options.description]
 * @param {File}   options.receiptFile   - Image file (required)
 * @param {object} [options.gps_location] - { lat, lng }
 */
export async function submitExpense({
  campaign_id,
  supervisor_id,
  amount,
  description,
  receiptFile,
  gps_location
}) {
  // ── Validation ────────────────────────────────────────────
  if (!campaign_id)   throw new Error('الحملة مطلوبة');
  if (!supervisor_id) throw new Error('معرّف المشرف مطلوب');
  if (!amount || amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  if (!receiptFile)   throw new Error('صورة الفاتورة مطلوبة');

  // ── Upload receipt to Storage ──────────────────────────────
  const ext  = receiptFile.name.split('.').pop();
  const path = `receipts/${supervisor_id}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, receiptFile, { contentType: receiptFile.type });

  if (uploadError) {
    throw new Error('فشل رفع صورة الفاتورة: ' + uploadError.message);
  }

  const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);

  // ── Insert expense row ─────────────────────────────────────
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      campaign_id,
      supervisor_id,
      amount,
      description:        description?.trim() ?? null,
      receipt_image_url:  urlData.publicUrl,
      gps_location:        gps_location ?? null,
      status:              'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}


// ── UPDATE ──────────────────────────────────────────────────

/**
 * Admin approves or rejects an expense.
 * On approval, also updates the campaign's budget (spent + warnings).
 *
 * @param {string} expenseId - Expense UUID
 * @param {'approved'|'rejected'} status
 */
export async function reviewExpense(expenseId, status) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('حالة غير صالحة');
  }

  const { data: expense, error } = await supabase
    .from('expenses')
    .update({ status })
    .eq('id', expenseId)
    .select()
    .single();

  if (error) throw error;

  // ── Sync budget on approval ────────────────────────────────
  if (status === 'approved') {
    await incrementBudgetSpent(expense.campaign_id, expense.amount);
  }

  return expense;
}

/**
 * Increment a campaign's budget.spent and recalculate warning flags.
 * Called automatically by reviewExpense() on approval.
 *
 * @param {string} campaignId
 * @param {number} amount
 */
async function incrementBudgetSpent(campaignId, amount) {
  const { data: budget, error: fetchError } = await supabase
    .from('budgets')
    .select('total, spent')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  if (fetchError || !budget) {
    console.warn('[ExpensesService] No budget record found for campaign:', campaignId);
    return;
  }

  const newSpent = Number(budget.spent) + Number(amount);
  const pct      = budget.total > 0 ? (newSpent / budget.total) * 100 : 0;

  const { error: updateError } = await supabase
    .from('budgets')
    .update({
      spent:       newSpent,
      warning_80:  pct >= 80,
      warning_90:  pct >= 90,
      warning_100: pct >= 100,
      updated_at:  new Date().toISOString()
    })
    .eq('campaign_id', campaignId);

  if (updateError) {
    console.warn('[ExpensesService] Failed to update budget:', updateError.message);
  }
}
