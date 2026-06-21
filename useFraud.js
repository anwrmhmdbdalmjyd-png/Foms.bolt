import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFraudFlags,
  countActiveFraudFlags,
  countFraudFlagsByCampaign,
  createFraudFlag,
  resolveFraudFlag
} from '../services/fraud.service';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useFraud.js
//
//  React Query wrappers around fraud.service.js.
//  (Added here because Dashboard.jsx and FraudDashboard.jsx
//  both need it, and it was missing from the original file list.)
// ============================================================

export function useFraudFlags({ campaignId, resolvedOnly, activeOnly } = {}) {
  return useQuery({
    queryKey: queryKeys.fraud.list({ campaignId, resolvedOnly, activeOnly }),
    queryFn: () => fetchFraudFlags({ campaignId, resolvedOnly, activeOnly })
  });
}

export function useFraudCount(campaignIds) {
  return useQuery({
    queryKey: queryKeys.fraud.count(campaignIds),
    queryFn: () => countActiveFraudFlags({ campaignIds })
  });
}

export function useFraudByCampaign(campaigns) {
  return useQuery({
    queryKey: ['fraud', 'byCampaign', campaigns?.map((c) => c.id)],
    queryFn: () => countFraudFlagsByCampaign(campaigns),
    enabled: !!campaigns?.length
  });
}

export function useCreateFraudFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFraudFlag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fraud.all })
  });
}

export function useResolveFraudFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveFraudFlag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fraud.all })
  });
}
