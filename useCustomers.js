import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCustomers,
  fetchCustomerById,
  countCustomersToday,
  fetchCustomerGrowth,
  registerCustomer,
  resendOtp,
  verifyOtp
} from '../services/customers.service';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useCustomers.js
//  React Query wrappers around customers.service.js.
// ============================================================


// ── QUERIES ─────────────────────────────────────────────────

/**
 * Fetch customers visible to the current user.
 * Subscribes to realtime changes on the `customers` table so
 * the list refreshes live when any agent registers someone new.
 *
 * @param {object} options
 * @param {string} options.role         - 'admin' | 'supervisor' | 'agent'
 * @param {string} [options.campaignId]
 * @param {string} [options.agentId]
 */
export function useCustomers({ role, campaignId, agentId } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.customers.list({ role, campaignId, agentId }),
    queryFn: () => fetchCustomers({ role, campaignId, agentId })
  });

  useEffect(() => {
    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/**
 * Fetch a single customer by ID.
 * @param {string} id
 * @param {string} role
 */
export function useCustomer(id, role) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => fetchCustomerById(id, role),
    enabled: !!id
  });
}

/**
 * Count of customers registered today.
 * Used directly by Dashboard KPI card.
 * @param {string[]} [campaignIds]
 */
export function useCustomersTodayCount(campaignIds) {
  return useQuery({
    queryKey: ['customers', 'todayCount', campaignIds],
    queryFn: () => countCustomersToday({ campaignIds })
  });
}

/**
 * Customer growth series for the Dashboard line chart.
 * @param {object} options
 * @param {string[]} [options.campaignIds]
 * @param {number}   [options.days=14]
 */
export function useCustomerGrowth({ campaignIds, days = 14 } = {}) {
  return useQuery({
    queryKey: ['customers', 'growth', campaignIds, days],
    queryFn: () => fetchCustomerGrowth({ campaignIds, days })
  });
}


// ── MUTATIONS ───────────────────────────────────────────────

/**
 * Register a new customer (generates + sends OTP).
 * Usage:
 *   const register = useRegisterCustomer();
 *   const { customer, otp } = await register.mutateAsync({ customer_phone, agent_id, campaign_id, gps_location });
 */
export function useRegisterCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    }
  });
}

/**
 * Resend OTP to an existing (unverified) customer.
 */
export function useResendOtp() {
  return useMutation({
    mutationFn: ({ customerId, agentId }) => resendOtp(customerId, agentId)
  });
}

/**
 * Verify the OTP entered by the agent on behalf of the customer.
 */
export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, otp }) => verifyOtp(customerId, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    }
  });
}
