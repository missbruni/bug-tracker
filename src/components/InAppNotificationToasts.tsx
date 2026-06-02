import React from 'react'
import { ArrowRight, MessageSquare, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  markInAppNotificationDismissed,
  markInAppNotificationRead,
  useInAppNotifications,
} from '../lib/useInAppNotifications'
import {
  useInAppNotificationStore,
  type InAppNotification,
} from '../stores/inAppNotificationStore'
import { useNotificationStore } from '../stores/notificationStore'

const AUTO_DISMISS_MS = 10000
const COMMENT_PREVIEW_LIMIT = 120

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function getNotificationSearchQuery(href: string | null): string {
  if (!href) return ''

  try {
    const baseUrl = window.location.origin === 'null' ? 'http://localhost' : window.location.origin
    return new URL(href, baseUrl).searchParams.get('q')?.trim() || ''
  } catch {
    return ''
  }
}

function NotificationToast({
  notification,
  onView,
  onDismiss,
  onAutoDismiss,
}: {
  notification: InAppNotification
  onView: (notification: InAppNotification) => void
  onDismiss: (notificationId: string) => void
  onAutoDismiss: (notificationId: string) => void
}) {
  React.useEffect(() => {
    const timeout = window.setTimeout(() => onAutoDismiss(notification.id), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timeout)
  }, [notification.id, onAutoDismiss])

  const body = notification.body ? truncateText(notification.body, COMMENT_PREVIEW_LIMIT) : ''

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-mushi-surface shadow-xl">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-mushi-primary/10 dark:text-mushi-primary">
          <MessageSquare size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-gray-100">
            {notification.title}
          </p>
          {body && (
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-gray-400">
              "{body}"
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {notification.href && (
              <button
                onClick={() => onView(notification)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer"
              >
                View bug
                <ArrowRight size={13} />
              </button>
            )}
            <button
              onClick={() => onDismiss(notification.id)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          aria-label="Dismiss notification"
          className="rounded-md p-1 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

export default function InAppNotificationToasts() {
  useInAppNotifications()

  const navigate = useNavigate()
  const notifications = useInAppNotificationStore((state) => state.notifications)
  const removeNotification = useInAppNotificationStore((state) => state.removeNotification)

  const dismissNotification = React.useCallback((notificationId: string) => {
    removeNotification(notificationId)
    void markInAppNotificationDismissed(notificationId)
  }, [removeNotification])

  const viewNotification = React.useCallback((notification: InAppNotification) => {
    removeNotification(notification.id)
    void markInAppNotificationRead(notification.id)
    const searchQuery = getNotificationSearchQuery(notification.href)
    if (searchQuery) useNotificationStore.getState().applyBugFilters({ clear: true, search: searchQuery })
    if (notification.href) navigate(notification.href)
  }, [navigate, removeNotification])

  if (!notifications.length) return null

  return (
    <div className="fixed bottom-20 right-4 z-60 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 md:bottom-5">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onView={viewNotification}
          onDismiss={dismissNotification}
          onAutoDismiss={dismissNotification}
        />
      ))}
    </div>
  )
}
