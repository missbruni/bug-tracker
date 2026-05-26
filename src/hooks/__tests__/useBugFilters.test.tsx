/// <reference lib="dom" />
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, act } from '@testing-library/react'
import { useBugFilters } from '../useBugFilters'
import { useNotificationStore } from '../../stores/notificationStore'
import type { Bug, Question, SessionOption } from '../../types'

afterEach(() => cleanup())

const makeBug = (overrides: Partial<Bug> = {}): Bug => ({
  id: 'HI-01',
  title: 'Test bug',
  description: '',
  severity: 'high',
  tester: 'Alice',
  device: 'Desktop Chrome',
  page: '/home',
  category: null,
  created_at: '2026-05-16T11:00:00.000Z',
  reviewed: false,
  session_id: null,
  comments: [],
  attachments: [],
  ...overrides,
})

function HookProbe({ bugs, questions, sessions = [] }: { bugs: Bug[]; questions: Question[]; sessions?: SessionOption[] }) {
  const filters = useBugFilters(bugs, questions, sessions)

  return (
    <>
      <div data-testid="severity-filter">{filters.severityFilter}</div>
      <div data-testid="filtered-ids">{filters.filtered.map((bug) => bug.id).join(',')}</div>
    </>
  )
}

describe('useBugFilters — AI severity filtering', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  test('applies combined severities from a natural-language severity string', () => {
    const bugs = [
      makeBug({ id: 'HI-01', severity: 'high' }),
      makeBug({ id: 'LO-01', severity: 'low' }),
      makeBug({ id: 'CRT-01', severity: 'critical' }),
    ]

    render(<HookProbe bugs={bugs} questions={[]} />)

    act(() => {
      useNotificationStore.getState().applyBugFilters({ severity: 'show only low and high bugs' })
    })

    expect(screen.getByTestId('severity-filter').textContent).toBe('high,low')
    expect(screen.getByTestId('filtered-ids').textContent).toBe('HI-01,LO-01')
  })

  test('applies multiple severities from the severities array field', () => {
    const bugs = [
      makeBug({ id: 'HI-01', severity: 'high' }),
      makeBug({ id: 'LO-01', severity: 'low' }),
      makeBug({ id: 'CRT-01', severity: 'critical' }),
    ]

    render(<HookProbe bugs={bugs} questions={[]} />)

    act(() => {
      useNotificationStore.getState().applyBugFilters({ severities: ['critical', 'low'] })
    })

    expect(screen.getByTestId('severity-filter').textContent).toBe('critical,low')
    expect(screen.getByTestId('filtered-ids').textContent).toBe('LO-01,CRT-01')
  })
})
