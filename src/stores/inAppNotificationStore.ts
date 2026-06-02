import { create } from 'zustand'

const MAX_VISIBLE_NOTIFICATIONS = 5

export type InAppNotificationType = 'bug_comment_mention'

export interface InAppNotification {
  id: string
  recipient_user_id: string
  team_id: string
  type: InAppNotificationType
  actor_user_id: string | null
  actor_name: string | null
  entity_type: string
  entity_id: string
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  dismissed_at: string | null
  created_at: string
}

interface InAppNotificationState {
  notifications: InAppNotification[]
  enqueueNotification: (notification: InAppNotification) => void
  removeNotification: (notificationId: string) => void
  clearNotifications: () => void
}

export const useInAppNotificationStore = create<InAppNotificationState>()((set) => ({
  notifications: [],
  enqueueNotification: (notification) =>
    set((state) => {
      if (state.notifications.some((existingNotification) => existingNotification.id === notification.id)) {
        return state
      }

      return {
        notifications: [notification, ...state.notifications].slice(0, MAX_VISIBLE_NOTIFICATIONS),
      }
    }),
  removeNotification: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== notificationId),
    })),
  clearNotifications: () => set({ notifications: [] }),
}))
