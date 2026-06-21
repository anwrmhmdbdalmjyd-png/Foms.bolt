import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaigns,
  fetchCampaignById,
  fetchCampaignAgents,
  countCampaigns,
  fetchMyCampaignIds,
  createCampaign,
  updateCampaign,
  toggleCampaignStatus,
  assignUserToCampaign,
  removeUserFromCampaign
} from '../services/campaigns.service';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useCampaigns.js
//
//  React Query wrappers around campaigns.service.js.
//  Pages import ONLY from this file — never from the service
//  directly. This keeps caching, loading states, and error
//  states consistent everywhere campaigns data is used.
// ============================================================


// ── QUERIES ─────────────────────────────────────────────────

/**
 * Fetch all campaigns visible to the current user (RLS-scoped).
 * Usage: const { data: campaigns, isLoading, isError } = useCampaigns();
 */
export function useCampaigns() {
  return useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: fetchCampaigns
  });
}

/**
 * Fetch a single campaign by ID.
 * @param {string} id - Campaign UUID
 */
export function useCampaign(id) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => fetchCampaignById(id),
    enabled: !!id // don't fire until id is available
  });
}

/**
 * Fetch agents/supervisors assigned to a campaign.
 * @param {string} campaignId
 */
export function useCampaignAgents(campaignId) {
  return useQuery({
    queryKey: ['campaigns', 'agents', campaignId],
    queryFn: () => fetchCampaignAgents(campaignId),
    enabled: !!campaignId
  });
}

/**
 * Count of campaigns visible to current user.
 * Used directly by Dashboard KPI card.
 */
export function useCampaignsCount() {
  return useQuery({
    queryKey: ['campaigns', 'count'],
    queryFn: countCampaigns
  });
}

/**
 * Campaign IDs the given user is assigned to.
 * Used by other hooks/pages to scope sub-queries
 * (e.g. Dashboard KPIs, fraud counts).
 * @param {string} userId
 */
export function useMyCampaignIds(userId) {
  return useQuery({
    queryKey: ['campaigns', 'myIds', userId],
    queryFn: () => fetchMyCampaignIds(userId),
    enabled: !!userId
  });
}


// ── MUTATIONS ───────────────────────────────────────────────

/**
 * Create a new campaign.
 * Invalidates the campaigns list on success so the UI refreshes.
 *
 * Usage:
 *   const createMutation = useCreateCampaign();
 *   createMutation.mutate({ name, budget, created_by });
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    }
  });
}

/**
 * Update a campaign's fields.
 * Invalidates both the list and the specific campaign's detail cache.
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }) => updateCampaign(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(data.id) });
    }
  });
}

/**
 * Toggle a campaign between 'active' and 'paused'.
 */
export function useToggleCampaignStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, currentStatus }) => toggleCampaignStatus(id, currentStatus),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(data.id) });
    }
  });
}

/**
 * Assign a user to a campaign.
 * Invalidates the campaign's agents list on success.
 */
export function useAssignUserToCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, userId }) => assignUserToCampaign(campaignId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'agents', variables.campaignId]
      });
    }
  });
}

/**
 * Remove a user from a campaign.
 */
export function useRemoveUserFromCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, userId }) => removeUserFromCampaign(campaignId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'agents', variables.campaignId]
      });
    }
  });
}
