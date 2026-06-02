import { beforeEach, describe, expect, test } from 'bun:test'
import {
  useInAppNotificationStore,
  type InAppNotification,
} from '../inAppNotificationStore'

function makeNotification(id: string): InAppNotification {
  return {
    id,
    recipient_user_id: 'user-1',
    team_id: 'team-1',
    type: 'bug_comment_mention',
    actor_user_id: 'user-2',
    actor_name: 'Alex',
    entity_type: 'comment',
    entity_id: `comment-${id}`,
    title: `Alex mentioned you on HI-${id}`,
    body: 'Please check this',
    href: `/?q=HI-${id}`,
    read_at: null,
    dismissed_at: null,
    created_at: new Date().toISOString(),
  }
}

beforeEach(() => {
  useInAppNotificationStore.getState().clearNotifications()
})

describe('useInAppNotificationStore', () => {
  test('enqueues notifications newest-first and dedupes by id', () => {
    const store = useInAppNotificationStore.getState()

    store.enqueueNotification(makeNotification('1'))
    store.enqueueNotification(makeNotification('2'))
    store.enqueueNotification(makeNotification('1'))

    expect(useInAppNotificationStore.getState().notifications.map((notification) => notification.id)).toEqual(['2', '1'])
  })

  test('keeps only the visible notification limit', () => {
    const store = useInAppNotificationStore.getState()

    Array.from({ length: 7 }).forEach((_, index) => {
      store.enqueueNotification(makeNotification(String(index + 1)))
    })

    expect(useInAppNotificationStore.getState().notifications.map((notification) => notification.id)).toEqual(['7', '6', '5', '4', '3'])
  })
})
