/// <reference lib="dom" />
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SessionWithStats } from '../../types'

type Session = SessionWithStats

const MOCK_SESSIONS: Session[] = [
  { id: 's1', name: 'Sprint 12', date: '2026-05-01', status: 'active', created_at: '2026-05-01T00:00:00Z', scenario_count: 3, assignment_count: 2 },
  { id: 's2', name: 'Sprint 11', date: '2026-04-15', status: 'completed', created_at: '2026-04-15T00:00:00Z', scenario_count: 5, assignment_count: 4, feedback_avg: 4.5, feedback_count: 2 },
  { id: 's3', name: 'Exploratory', date: null, status: 'draft', created_at: '2026-04-01T00:00:00Z', scenario_count: 0, assignment_count: 0 },
]

const queryResult = {
  data: MOCK_SESSIONS,
  isLoading: false,
}

const productsResult = {
  data: [],
}

mock.module('@tanstack/react-query', () => ({
  QueryClient: class { defaultOptions = {} },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === 'products') return productsResult
    return queryResult
  },
  useQueryClient: () => ({
    setQueryData: mock(() => {}),
    invalidateQueries: mock(() => {}),
  }),
}))

mock.module('../../supabaseClient', () => ({ supabase: null }))
mock.module('../../lib/teamAccess', () => ({
  useTeamAccess: () => ({ activeTeamId: 'team-1', activeTeam: null, teams: [], isGodMode: false, setActiveTeamId: () => {} }),
}))
mock.module('../../lib/sessionTimer', () => ({
  useSessionTimer: () => ({ timer: null, elapsed: 0, startTimer: mock(() => {}), pauseTimer: mock(() => {}), resumeTimer: mock(() => {}), stopTimer: mock(() => {}) }),
}))

const { default: SessionsListPage } = await import('../SessionsListPage')

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SessionsListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  queryResult.data = MOCK_SESSIONS
  queryResult.isLoading = false
})

afterEach(() => cleanup())

describe('SessionsListPage', () => {
  test('renders session names', () => {
    renderPage()
    expect(screen.getByText('Sprint 12')).toBeInTheDocument()
    expect(screen.getByText('Sprint 11')).toBeInTheDocument()
    expect(screen.getByText('Exploratory')).toBeInTheDocument()
  })

  test('renders scenario and assignment counts', () => {
    renderPage()
    expect(screen.getByText('3 scenarios')).toBeInTheDocument()
    expect(screen.getByText('2 assigned')).toBeInTheDocument()
  })

  test('shows active count in stats bar', () => {
    renderPage()
    expect(screen.getByText('1 active')).toBeInTheDocument()
  })

  test('shows empty state when no sessions', () => {
    queryResult.data = []
    renderPage()
    expect(screen.getByText(/No sessions yet/)).toBeInTheDocument()
  })

  test('New Session button opens creation form', () => {
    renderPage()
    fireEvent.click(screen.getByText('New Session'))
    expect(screen.getByPlaceholderText('Session name *')).toBeInTheDocument()
  })

  test('Create button is disabled when name is empty', () => {
    renderPage()
    fireEvent.click(screen.getByText('New Session'))
    expect(screen.getByText('Create')).toBeDisabled()
  })

  test('search filters sessions by name', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), { target: { value: 'Sprint 12' } })
    expect(screen.getByText('Sprint 12')).toBeInTheDocument()
    expect(screen.queryByText('Exploratory')).not.toBeInTheDocument()
  })

  test('search filters sessions by status', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), { target: { value: 'draft' } })
    expect(screen.getByText('Exploratory')).toBeInTheDocument()
    expect(screen.queryByText('Sprint 12')).not.toBeInTheDocument()
  })

  test('delete button opens confirm modal requiring session name', () => {
    renderPage()
    const deleteButtons = screen.getAllByLabelText('Delete')
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText('Delete session?')).toBeInTheDocument()
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('delete confirm enables when session name is typed', () => {
    renderPage()
    const deleteButtons = screen.getAllByLabelText('Delete')
    fireEvent.click(deleteButtons[0])
    fireEvent.change(screen.getByPlaceholderText('Sprint 12'), { target: { value: 'Sprint 12' } })
    expect(screen.getByText('Delete permanently')).not.toBeDisabled()
  })

  test('delete confirm stays disabled with wrong text', () => {
    renderPage()
    const deleteButtons = screen.getAllByLabelText('Delete')
    fireEvent.click(deleteButtons[0])
    fireEvent.change(screen.getByPlaceholderText('Sprint 12'), { target: { value: 'wrong' } })
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('cancel closes delete confirm modal', () => {
    renderPage()
    const deleteButtons = screen.getAllByLabelText('Delete')
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText('Delete session?')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete session?')).not.toBeInTheDocument()
  })

  test('Start button appears for non-completed sessions', () => {
    renderPage()
    const startButtons = screen.getAllByText('Start')
    expect(startButtons.length).toBeGreaterThan(0)
  })

  test('completed session shows feedback rating', () => {
    renderPage()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })
})
