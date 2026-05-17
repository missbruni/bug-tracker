/// <reference lib="dom" />
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const clearAuthError = mock(() => {})
const fetchPinSession = mock(async () => ({ authenticated: false, role: null, configured: true }))
const logoutPinSession = mock(async () => {})
const cachePinRole = mock(() => {})
const submitPin = mock(async () => ({ role: 'team' as const }))

const authState: {
  loading: boolean
  session: Session | null
  authError: string | null
  allowedEmailDomain: string
  clearAuthError: () => void
} = {
  loading: false,
  session: null,
  authError: null,
  allowedEmailDomain: 'theaccessgroup.com',
  clearAuthError,
}

mock.module('../../supabaseClient', () => ({
  supabase: {},
}))

mock.module('../../lib/useAuth', () => ({
  useAuth: () => authState,
}))

mock.module('../../lib/pinAuth', () => ({
  fetchPinSession,
  submitPin,
  logoutPinSession,
  cachePinRole,
}))

const { default: AuthGate } = await import('../AuthGate')

beforeEach(() => {
  sessionStorage.clear()
  clearAuthError.mockClear()
  fetchPinSession.mockReset()
  fetchPinSession.mockImplementation(async () => ({ authenticated: false, role: null, configured: true }))
  submitPin.mockClear()
  logoutPinSession.mockClear()
  cachePinRole.mockClear()

  authState.loading = false
  authState.session = null
  authState.authError = null
  authState.allowedEmailDomain = 'theaccessgroup.com'
})

afterEach(() => cleanup())

describe('AuthGate', () => {
  test('renders login screen when no session and pin is locked', async () => {
    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    await waitFor(() => {
      expect(screen.getByText('Sign in with your company Microsoft account to continue.')).toBeInTheDocument()
    })
    expect(screen.queryByText('App Content')).not.toBeInTheDocument()
  })

  test('renders children when pin session is authenticated', async () => {
    fetchPinSession.mockImplementation(async () => ({ authenticated: true, role: 'team', configured: true }))

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    await waitFor(() => {
      expect(screen.getByText('App Content')).toBeInTheDocument()
    })
  })

  test('handles pin-lock event by clearing pin session and returning to login', async () => {
    fetchPinSession.mockImplementation(async () => ({ authenticated: true, role: 'team', configured: true }))

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    await waitFor(() => {
      expect(screen.getByText('App Content')).toBeInTheDocument()
    })

    act(() => {
      window.dispatchEvent(new CustomEvent('pin-lock'))
    })

    await waitFor(() => {
      expect(screen.queryByText('App Content')).not.toBeInTheDocument()
    })

    expect(logoutPinSession).toHaveBeenCalled()
    expect(screen.getByText('Sign in with your company Microsoft account to continue.')).toBeInTheDocument()
  })
})
