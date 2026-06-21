import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAttendance,
  fetchTodayCheckIn,
  fetchAttendanceRate,
  countAgents,
  registerAttendance,
  verifyAttendance
} from '../services/attendance.service';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useAttendance.js
//  React Query wrappers around attendance.service.js.
// ============================================================


// ── QUERIES ─────────────────────────────────────────────────

/**
 * Fetch attendance records visible to the current user.
 * @param {object} options
 * @param {string} [options.campaignId]
 * @param {string} [options.userId]
 */
export function useAttendance({ campaignId, userId } = {}) {
  return useQuery({
    queryKey: queryKeys.attendance.list({ campaignId, userId }),
    queryFn: () => fetchAttendance({ campaignId, userId })
  });
}

/**
 * Check if the given user has already checked in today.
 * @param {string} userId
 */
export function useTodayCheckIn(userId) {
  return useQuery({
    queryKey: queryKeys.attendance.today(userId),
    queryFn: () => fetchTodayCheckIn(userId),
    enabled: !!userId
  });
}

/**
 * Real agent headcount for given campaigns (via assignments table).
 * Required before calling useAttendanceRate.
 * @param {string[]} [campaignIds]
 */
export function useAgentsCount(campaignIds) {
  return useQuery({
    queryKey: ['attendance', 'agentsCount', campaignIds],
    queryFn: () => countAgents(campaignIds)
  });
}

/**
 * Today's attendance rate percentage.
 * Used directly by Dashboard KPI card.
 * @param {object} options
 * @param {string[]} [options.campaignIds]
 * @param {number}   options.totalAgents - from useAgentsCount()
 */
export function useAttendanceRate({ campaignIds, totalAgents } = {}) {
  return useQuery({
    queryKey: ['attendance', 'rate', campaignIds, totalAgents],
    queryFn: () => fetchAttendanceRate({ campaignIds, totalAgents }),
    enabled: totalAgents !== undefined
  });
}


// ── MUTATIONS ───────────────────────────────────────────────

/**
 * Register today's check-in for an agent.
 */
export function useRegisterAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerAttendance,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.today(variables.user_id)
      });
    }
  });
}

/**
 * Supervisor verifies, rejects, or flags an attendance record.
 */
export function useVerifyAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attendanceId, status }) => verifyAttendance(attendanceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
    }
  });
}
