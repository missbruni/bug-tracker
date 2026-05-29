/// <reference lib="dom" />
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

let mockUser: { id: string; email: string; user_metadata: Record<string, unknown> } | null = null
const updateUser = mock(async () => ({ data: {}, error: null }))

mock.module('../../lib/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
  getUserDisplayName: () => 'Test',
}))

mock.module('../../supabaseClient', () => ({
  supabase: { auth: { updateUser } },
}))

const { useOnboardingTour } = await import('../useOnboardingTour')

function Probe() {
  const { shouldShow, markComplete } = useOnboardingTour()
  return (
    <>
      <div data-testid="should-show">{String(shouldShow)}</div>
      <button onClick={() => { void markComplete() }}>complete</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  updateUser.mockClear()
})

describe('useOnboardingTour', () => {
  beforeEach(() => {
    mockUser = null
  })

  test('shouldShow is false when no user is signed in', () => {
    mockUser = null
    render(<Probe />)
    expect(screen.getByTestId('should-show').textContent).toBe('false')
  })

  test('shouldShow is true for a signed-in user with no onboarded_at', () => {
    mockUser = { id: 'u1', email: 'a@example.com', user_metadata: {} }
    render(<Probe />)
    expect(screen.getByTestId('should-show').textContent).toBe('true')
  })

  test('shouldShow is false once onboarded_at is set', () => {
    mockUser = { id: 'u1', email: 'a@example.com', user_metadata: { onboarded_at: '2026-05-29T00:00:00Z' } }
    render(<Probe />)
    expect(screen.getByTestId('should-show').textContent).toBe('false')
  })

  test('markComplete hides the tour locally and writes onboarded_at to user metadata', async () => {
    mockUser = { id: 'u1', email: 'a@example.com', user_metadata: { existing: 'value' } }
    render(<Probe />)
    expect(screen.getByTestId('should-show').textContent).toBe('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'complete' }))
    })

    expect(screen.getByTestId('should-show').textContent).toBe('false')
    expect(updateUser).toHaveBeenCalledTimes(1)
    const arg = updateUser.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data.existing).toBe('value')
    expect(typeof arg.data.onboarded_at).toBe('string')
  })
})
