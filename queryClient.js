import { QueryClient } from '@tanstack/react-query';

// ============================================================
//  src/lib/queryClient.js
//
//  Global React Query configuration.
//  One instance shared across the entire app via
//  <QueryClientProvider> in main.jsx.
//
//  ARCHITECTURE NOTE:
//  All Supabase calls flow through:
//  Services → Hooks (useQuery/useMutation) → Pages/Components
//  Pages never call Supabase directly.
// ============================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ── Caching & Staleness ───────────────────────────────
      // Data is considered fresh for 30 seconds.
      // After that, React Query will refetch in the background
      // the next time the query is used.
      staleTime: 30 * 1000,

      // Keep unused data in cache for 5 minutes before
      // garbage collecting it.
      gcTime: 5 * 60 * 1000,

      // ── Refetch Behavior ─────────────────────────────────
      // Refetch when the browser tab regains focus (user
      // switches back to the app after being elsewhere).
      refetchOnWindowFocus: true,

      // Refetch when network reconnects after going offline.
      refetchOnReconnect: true,

      // Do NOT refetch just because the component remounts
      // (avoids duplicate requests on navigation).
      refetchOnMount: false,

      // ── Error Handling ───────────────────────────────────
      // Retry once on failure to absorb transient network
      // blips — but not more, so real errors surface fast.
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000)
    },

    mutations: {
      // Never auto-retry mutations — a failed write (INSERT,
      // UPDATE, DELETE) should not be retried silently because
      // it may have already partially executed on the server.
      retry: 0
    }
  }
});

// ============================================================
//  Query Key Factory
//
//  Centralized, structured query keys.
//  Benefits:
//  - Avoids typos causing cache misses.
//  - Makes targeted cache invalidation easy and explicit.
//  - Single source of truth for all query identifiers.
//
//  Usage example:
//    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
//    queryClient.invalidateQueries({ queryKey: queryKeys.customers.list() })
// ============================================================

export const queryKeys = {
  // ── Campaigns ────────────────────────────────────────────
  campaigns: {
    all:    ['campaigns'],
    list:   (filters) => ['campaigns', 'list', filters ?? {}],
    detail: (id)      => ['campaigns', 'detail', id]
  },

  // ── Customers ────────────────────────────────────────────
  customers: {
    all:    ['customers'],
    list:   (filters) => ['customers', 'list', filters ?? {}],
    detail: (id)      => ['customers', 'detail', id]
  },

  // ── Attendance ───────────────────────────────────────────
  attendance: {
    all:    ['attendance'],
    list:   (filters) => ['attendance', 'list', filters ?? {}],
    today:  (userId)  => ['attendance', 'today', userId]
  },

  // ── Expenses ─────────────────────────────────────────────
  expenses: {
    all:    ['expenses'],
    list:   (filters) => ['expenses', 'list', filters ?? {}]
  },

  // ── Tasks ────────────────────────────────────────────────
  tasks: {
    all:    ['tasks'],
    list:   (filters) => ['tasks', 'list', filters ?? {}]
  },

  // ── Fraud ────────────────────────────────────────────────
  fraud: {
    all:    ['fraud'],
    list:   (filters) => ['fraud', 'list', filters ?? {}],
    count:  (filters) => ['fraud', 'count', filters ?? {}]
  },

  // ── Notifications ────────────────────────────────────────
  notifications: {
    all:    ['notifications'],
    unread: (userId) => ['notifications', 'unread', userId]
  },

  // ── Dashboard ────────────────────────────────────────────
  dashboard: {
    kpis:   (role, ids) => ['dashboard', 'kpis',   role, ids ?? []],
    charts: (role, ids) => ['dashboard', 'charts', role, ids ?? []]
  },

  // ── Users / Assignments ──────────────────────────────────
  users: {
    all:  ['users'],
    list: (filters) => ['users', 'list', filters ?? {}]
  },

  assignments: {
    all:        ['assignments'],
    byCampaign: (campaignId) => ['assignments', 'campaign', campaignId]
  }
};
