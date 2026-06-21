import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExpenses,
  sumApprovedExpenses,
  submitExpense,
  reviewExpense
} from '../services/expenses.service';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useExpenses.js
//  React Query wrappers around expenses.service.js.
// ============================================================


// ── QUERIES ─────────────────────────────────────────────────

/**
 * Fetch expenses visible to the current user.
 * @param {object} options
 * @param {string} [options.campaignId]
 * @param {string} [options.status]
 * @param {string} [options.supervisorId]
 */
export function useExpenses({ campaignId, status, supervisorId } = {}) {
  return useQuery({
    queryKey: queryKeys.expenses.list({ campaignId, status, supervisorId }),
    queryFn: () => fetchExpenses({ campaignId, status, supervisorId })
  });
}

/**
 * Sum of approved expenses across given campaigns.
 * Used directly by Dashboard KPI card.
 * @param {string[]} campaignIds
 */
export function useApprovedExpensesTotal(campaignIds = []) {
  return useQuery({
    queryKey: ['expenses', 'approvedTotal', campaignIds],
    queryFn: () => sumApprovedExpenses(campaignIds)
  });
}


// ── MUTATIONS ───────────────────────────────────────────────

/**
 * Submit a new expense with a receipt image.
 * Usage:
 *   const submit = useSubmitExpense();
 *   submit.mutate({ campaign_id, supervisor_id, amount, description, receiptFile, gps_location });
 */
export function useSubmitExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    }
  });
}

/**
 * Admin approves or rejects an expense.
 * Also invalidates campaigns (since budget.spent changes on approval).
 */
export function useReviewExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, status }) => reviewExpense(expenseId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    }
  });
}
