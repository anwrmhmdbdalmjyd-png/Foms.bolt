import { supabase } from '../lib/supabase';

// ============================================================
//  src/services/tasks.service.js
//
//  ALL Supabase queries related to tasks live here.
//
//  Tables used:
//  - tasks     (main data — title, status, due date)
//  - users     (resolved manually — see FK note below)
//  - campaigns (resolved manually — see FK note below)
//
//  IMPORTANT — FK naming note:
//  Same approach as attendance.service.js and expenses.service.js:
//  rather than relying on a nested `.select('*, users(...)')` or a
//  guessed `table!constraint_fkey` hint (which breaks if your FK
//  constraints weren't named in Postgres's default pattern), this
//  service resolves assignee/campaign names via a manual second
//  query + in-memory map. Works regardless of constraint naming.
//
//  RLS note:
//  - Agent      → sees only tasks assigned to them
//  - Supervisor → sees/creates tasks for their assigned campaigns
//  - Admin      → sees everything
// ============================================================


// ── READ ────────────────────────────────────────────────────

/**
 * Fetch tasks visible to the current user.
 * Resolves assignee name and campaign name via manual join.
 *
 * @param {object} options
 * @param {string} [options.campaignId]  - Filter by campaign
 * @param {string} [options.assignedTo]  - Filter by assignee (agent's own tasks)
 */
export async function fetchTasks({ campaignId, assignedTo } = {}) {
  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId)  query = query.eq('campaign_id', campaignId);
  if (assignedTo)  query = query.eq('assigned_to', assignedTo);

  const { data, error } = await query;
  if (error) throw error;

  const records = data ?? [];
  if (records.length === 0) return [];

  return attachRelatedNames(records);
}

/**
 * Resolve assigned_to and campaign_id into readable names
 * via manual lookup (not a nested Supabase embed).
 * @param {Array} records - Raw task rows
 */
async function attachRelatedNames(records) {
  const userIds     = [...new Set(records.map((r) => r.assigned_to).filter(Boolean))];
  const campaignIds = [...new Set(records.map((r) => r.campaign_id).filter(Boolean))];

  const [{ data: users }, { data: campaigns }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
      : Promise.resolve({ data: [] })
  ]);

  const userMap     = new Map((users ?? []).map((u) => [u.id, u]));
  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c]));

  return records.map((r) => ({
    ...r,
    assignee: userMap.get(r.assigned_to) ?? null,
    campaign: campaignMap.get(r.campaign_id) ?? null
  }));
}

/**
 * Count tasks grouped by status for a given assignee or campaign.
 * Useful for small KPI breakdowns (e.g. "3 pending, 5 completed").
 *
 * @param {object} options
 * @param {string} [options.campaignId]
 * @param {string} [options.assignedTo]
 */
export async function countTasksByStatus({ campaignId, assignedTo } = {}) {
  let query = supabase.from('tasks').select('status');

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
}


// ── CREATE ──────────────────────────────────────────────────

/**
 * Create a new task and assign it to an agent.
 *
 * @param {object} options
 * @param {string} options.campaign_id  - Campaign UUID (required)
 * @param {string} options.assigned_to  - Agent UUID (required)
 * @param {string} options.title        - Task title (required)
 * @param {string} [options.description]
 * @param {string} [options.due_date]
 * @param {string} [options.assigned_by] - Supervisor/Admin UUID who created it
 */
export async function createTask({
  campaign_id,
  assigned_to,
  title,
  description,
  due_date,
  assigned_by
}) {
  // ── Validation ────────────────────────────────────────────
  if (!campaign_id)  throw new Error('الحملة مطلوبة');
  if (!assigned_to)  throw new Error('المندوب المكلّف مطلوب');
  if (!title?.trim()) throw new Error('عنوان المهمة مطلوب');

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      campaign_id,
      assigned_to,
      assigned_by:  assigned_by ?? null,
      title:        title.trim(),
      description:  description?.trim() ?? null,
      due_date:     due_date ?? null,
      status:       'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}


// ── UPDATE ──────────────────────────────────────────────────

/**
 * Update a task's status.
 * Typically called by the agent when they complete a task.
 *
 * @param {string} taskId - Task UUID
 * @param {'pending'|'in_progress'|'completed'|'cancelled'} status
 */
export async function updateTaskStatus(taskId, status) {
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new Error('حالة غير صالحة');
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Reassign a task to a different agent.
 * @param {string} taskId
 * @param {string} newAssigneeId
 */
export async function reassignTask(taskId, newAssigneeId) {
  if (!newAssigneeId) throw new Error('المندوب الجديد مطلوب');

  const { data, error } = await supabase
    .from('tasks')
    .update({ assigned_to: newAssigneeId, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
