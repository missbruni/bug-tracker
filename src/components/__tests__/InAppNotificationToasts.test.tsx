/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { InAppNotification } from '../../stores/inAppNotificationStore'
import { useInAppNotificationStore } from '../../stores/inAppNotificationStore'
import { useNotificationStore } from '../../stores/notificationStore'

const useInAppNotifications = mock(() => {})
const markInAppNotificationRead = mock(async (_notificationId: string) => {})
const markInAppNotificationDismissed = mock(async (_notificationId: string) => {})

mock.module('../../lib/useInAppNotifications', () => ({
  useInAppNotifications,
  markInAppNotificationRead,
  markInAppNotificationDismissed,
}))

const { default: InAppNotificationToasts } = await import('../InAppNotificationToasts')

function makeNotification(overrides: Partial<InAppNotification> = {}): InAppNotification {
  return {
    id: 'notification-1',
    recipient_user_id: 'user-1',
    team_id: 'team-1',
    type: 'bug_comment_mention',
    actor_user_id: 'user-2',
    actor_name: 'Alex',
    entity_type: 'comment',
    entity_id: '123',
    title: 'Alex mentioned you on HI-01',
    body: 'Can you validate this on Safari?',
    href: '/?q=HI-01',
    read_at: null,
    dismissed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderToasts() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <InAppNotificationToasts />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useInAppNotificationStore.getState().clearNotifications()
  useInAppNotifications.mockClear()
  markInAppNotificationRead.mockClear()
  markInAppNotificationDismissed.mockClear()
})

afterEach(() => cleanup())

describe('InAppNotificationToasts', () => {
  test('renders queued mention notification', () => {
    useInAppNotificationStore.getState().enqueueNotification(makeNotification())

    renderToasts()

    expect(screen.getByText('Alex mentioned you on HI-01')).toBeInTheDocument()
    expect(screen.getByText('"Can you validate this on Safari?"')).toBeInTheDocument()
  })

  test('dismisses notification and marks it dismissed', () => {
    useInAppNotificationStore.getState().enqueueNotification(makeNotification())

    renderToasts()
    fireEvent.click(screen.getByText('Dismiss'))

    expect(markInAppNotificationDismissed).toHaveBeenCalledWith('notification-1')
    expect(screen.queryByText('Alex mentioned you on HI-01')).not.toBeInTheDocument()
  })

  test('views notification and marks it read', () => {
    useInAppNotificationStore.getState().enqueueNotification(makeNotification())
    const previousVersion = useNotificationStore.getState().bugFiltersCommand.version

    renderToasts()
    fireEvent.click(screen.getByText('View bug'))

    expect(markInAppNotificationRead).toHaveBeenCalledWith('notification-1')
    expect(useNotificationStore.getState().bugFiltersCommand).toEqual({
      payload: { clear: true, search: 'HI-01' },
      version: previousVersion + 1,
    })
    expect(screen.queryByText('Alex mentioned you on HI-01')).not.toBeInTheDocument()
  })
})
