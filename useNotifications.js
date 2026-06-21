import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryClient';

// ============================================================
//  src/hooks/useNotifications.js
//
//  Unlike the other hooks, this one queries Supabase directly
//  for simple notification reads/writes rather than going
//  through a dedicated notifications.service.js file. This is
//  intentional and limited to this hook only — if notification
//  logic grows beyond these three operations, extract them into
//  notifications.service.js following the same pattern as the
//  other services.
// ============================================================


/**
 * Fetch unread notifications for a user, with live realtime updates.
 * Used by Topbar.jsx for the unread badge counter.
 * @param {string} userId
 */
export function useUnreadNotifications(userId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.notifications.unread(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.unread(userId)
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

/**
 * Fetch all notifications (read + unread) for the Notifications page.
 * @param {string} userId
 */
export function useAllNotifications(userId) {
  return useQuery({
    queryKey: ['notifications', 'all', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId
  });
}

/**
 * Mark a single notification as read.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
  });
}
