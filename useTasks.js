import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTasks,
  countTasksByStatus,
  createTask,
  updateTaskStatus,
  reassignTask
} from '../services/tasks.service';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useTasks.js
//  React Query wrappers around tasks.service.js.
// ============================================================


// ── QUERIES ─────────────────────────────────────────────────

/**
 * Fetch tasks visible to the current user.
 * Subscribes to realtime changes so the list updates live when
 * a supervisor creates a task or an agent completes one.
 *
 * @param {object} options
 * @param {string} [options.campaignId]
 * @param {string} [options.assignedTo]
 */
export function useTasks({ campaignId, assignedTo } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tasks.list({ campaignId, assignedTo }),
    queryFn: () => fetchTasks({ campaignId, assignedTo })
  });

  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
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
 * Task counts grouped by status.
 * @param {object} options
 * @param {string} [options.campaignId]
 * @param {string} [options.assignedTo]
 */
export function useTasksByStatus({ campaignId, assignedTo } = {}) {
  return useQuery({
    queryKey: ['tasks', 'byStatus', campaignId, assignedTo],
    queryFn: () => countTasksByStatus({ campaignId, assignedTo })
  });
}


// ── MUTATIONS ───────────────────────────────────────────────

/**
 * Create a new task.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}

/**
 * Update a task's status (e.g. agent marks it completed).
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }) => updateTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}

/**
 * Reassign a task to a different agent.
 */
export function useReassignTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newAssigneeId }) => reassignTask(taskId, newAssigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}
