/// <reference lib="dom" />
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const MOCK_SESSION = { id: 'sess-1', name: 'Sprint 12', date: '2026-05-01', status: 'active' as const, created_at: '2026-05-01T00:00:00Z' }
const MOCK_SCENARIOS = [
  { id: 'sc1', session_id: 'sess-1', letter: 'A', title: 'Login flow', description: 'Test SSO', sort_order: 0, device_requirement: '' },
  { id: 'sc2', session_id: 'sess-1', letter: 'B', title: 'Checkout', description: 'Test payment', sort_order: 1, device_requirement: 'Mobile' },
]
const MOCK_TESTERS = [
  { id: 't1', name: 'Bruna', devices: ['Desktop Chrome'], active: true },
  { id: 't2', name: 'Alex', devices: ['iPhone Safari'], active: true },
]
const MOCK_ASSIGNMENTS = [
  { id: 'a1', session_id: 'sess-1', scenario_id: 'sc1', tester_id: 't1' },
]

const state = {
  session: MOCK_SESSION as typeof MOCK_SESSION | null,
  scenarios: MOCK_SCENARIOS,
  testers: MOCK_TESTERS,
  assignments: MOCK_ASSIGNMENTS,
}

function buildChain(data: unknown, count?: number) {
  const chain: Record<string, unknown> = {}
  const terminal = { data, count: count ?? null, error: null }
  const self = () => chain
  chain.select = (..._args: unknown[]) => chain
  chain.eq = self
  chain.neq = self
  chain.in = self
  chain.gte = self
  chain.lt = self
  chain.like = self
  chain.ilike = self
  chain.order = self
  chain.limit = self
  chain.single = () => terminal
  chain.delete = self
  chain.update = (_p: unknown) => chain
  chain.insert = (_p: unknown) => ({ ...chain, select: () => ({ data: [_p], error: null }) })
  chain.then = (resolve: (v: unknown) => void) => { resolve(terminal); return chain }
  // Make it thenable for await
  Object.defineProperty(chain, 'data', { get: () => data })
  Object.defineProperty(chain, 'error', { get: () => null })
  Object.defineProperty(chain, 'count', { get: () => count ?? null })
  return chain
}

mock.module('../../supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'sessions') return buildChain(state.session)
      if (table === 'scenarios') return buildChain(state.scenarios)
      if (table === 'testers') return buildChain(state.testers)
      if (table === 'assignments') return buildChain(state.assignments)
      if (table === 'teams') return buildChain({ name: 'EVO IBE' })
      if (table === 'products') return buildChain({ name: 'Booking Engine' })
      if (table === 'bugs') return buildChain([], 3)
      return buildChain([])
    },
  },
}))

mock.module('../../lib/teamAccess', () => ({
  useTeamAccess: () => ({ activeTeamId: 'team-1', activeTeam: null, teams: [], isGodMode: false, setActiveTeamId: () => {} }),
}))

mock.module('../../lib/sessionTimer', () => ({
  useSessionTimer: () => ({ timer: null, elapsed: 0, startTimer: mock(() => {}), pauseTimer: mock(() => {}), resumeTimer: mock(() => {}), stopTimer: mock(async () => {}) }),
}))

const { default: SessionSetupPage } = await import('../SessionSetupPage')

function renderPage(sessionId = 'sess-1') {
  return render(
    <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionSetupPage />} />
        <Route path="/sessions" element={<div>Sessions List</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.session = { ...MOCK_SESSION }
  state.scenarios = [...MOCK_SCENARIOS]
  state.testers = [...MOCK_TESTERS]
  state.assignments = [...MOCK_ASSIGNMENTS]
})

afterEach(() => cleanup())

describe('SessionSetupPage', () => {
  test('renders session title', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
  })

  test('renders scenarios', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Login flow')).toBeInTheDocument())
    expect(screen.getByText('Checkout')).toBeInTheDocument()
  })

  test('shows session not found when session is null', async () => {
    state.session = null
    renderPage()
    await waitFor(() => expect(screen.getByText('Session not found')).toBeInTheDocument())
    expect(screen.getByText(/deleted or the link is invalid/)).toBeInTheDocument()
  })

  test('not found page has back link', async () => {
    state.session = null
    renderPage()
    await waitFor(() => expect(screen.getByText('← Back to Sessions')).toBeInTheDocument())
  })

  test('clicking title enters edit mode', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Click to edit title'))
    const input = screen.getByDisplayValue('Sprint 12')
    expect(input).toBeInTheDocument()
    expect(input.tagName.toLowerCase()).toBe('input')
  })

  test('pressing Escape cancels title edit', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Click to edit title'))
    const input = screen.getByDisplayValue('Sprint 12')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('Sprint 12')).toBeInTheDocument()
  })

  test('pressing Enter saves title edit', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Click to edit title'))
    const input = screen.getByDisplayValue('Sprint 12')
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('New Title')).toBeInTheDocument())
  })

  test('shows Scenarios heading with add/copy buttons', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Scenarios')).toBeInTheDocument())
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Copy from...')).toBeInTheDocument()
  })

  test('shows tester pool', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Bruna').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Alex').length).toBeGreaterThan(0)
  })

  test('delete button opens confirm modal requiring session name', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Delete session?')).toBeInTheDocument()
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('delete confirm enables when session name is typed', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.change(screen.getByPlaceholderText('Sprint 12'), { target: { value: 'Sprint 12' } })
    expect(screen.getByText('Delete permanently')).not.toBeDisabled()
  })

  test('delete confirm stays disabled with wrong text', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.change(screen.getByPlaceholderText('Sprint 12'), { target: { value: 'wrong' } })
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('cancel closes delete confirm modal', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Sprint 12')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Delete session?')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete session?')).not.toBeInTheDocument()
  })

  test('shows Present link', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Present')).toBeInTheDocument())
  })

  test('shows Start Timer button when no timer active', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Start Timer')).toBeInTheDocument())
  })
})
