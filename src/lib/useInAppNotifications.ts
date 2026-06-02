import React from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './useAuth'
import {
  useInAppNotificationStore,
  type InAppNotification,
} from '../stores/inAppNotificationStore'

const RECENT_NOTIFICATION_HOURS = 24
const INITIAL_NOTIFICATION_LIMIT = 5
type NotificationSeenField = 'read_at' | 'dismissed_at'

function getRecentCutoffIso(): string {
  return new Date(Date.now() - RECENT_NOTIFICATION_HOURS * 60 * 60 * 1000).toISOString()
}

async function markInAppNotificationSeen(notificationId: string, field: NotificationSeenField): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('notifications')
    .update({ [field]: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) console.warn(`[notifications] failed to update ${field}:`, error)
}

export async function markInAppNotificationRead(notificationId: string): Promise<void> {
  await markInAppNotificationSeen(notificationId, 'read_at')
}

export async function markInAppNotificationDismissed(notificationId: string): Promise<void> {
  await markInAppNotificationSeen(notificationId, 'dismissed_at')
}

export function useInAppNotifications() {
  const { user } = useAuth()

  React.useEffect(() => {
    const { clearNotifications, enqueueNotification } = useInAppNotificationStore.getState()
    clearNotifications()

    if (!supabase || !user?.id) return

    const userId = user.id
    const sb = supabase
    let cancelled = false

    const fetchUnseenNotifications = async () => {
      const { data, error } = await sb
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .is('read_at', null)
        .is('dismissed_at', null)
        .gte('created_at', getRecentCutoffIso())
        .order('created_at', { ascending: false })
        .limit(INITIAL_NOTIFICATION_LIMIT)

      if (cancelled) return
      if (error) {
        console.warn('[notifications] failed to fetch unseen:', error)
        return
      }

      ;((data || []) as InAppNotification[])
        .slice()
        .reverse()
        .forEach((notification) => enqueueNotification(notification))
    }

    void fetchUnseenNotifications()

    const channel = sb
      .channel(`in-app-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          enqueueNotification(payload.new as InAppNotification)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      sb.removeChannel(channel)
    }
  }, [user?.id])
}
