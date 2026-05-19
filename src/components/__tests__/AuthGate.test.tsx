/// <reference lib="dom" />
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const clearAuthError = mock(() => {})
const signInWithMicrosoft = mock(async () => {})
const fetchPinSession = mock(async () => ({ authenticated: false, role: null, configured: true }))
const logoutPinSession = mock(async () => {})
const cachePinRole = mock(() => {})
const submitPin = mock(async () => ({ role: 'team' as const }))
const microsoftLoginEnabled = { value: false }

const authState: {
  loading: boolean
  session: Session | null
  authError: string | null
  allowedEmailDomain: string
  signInWithMicrosoft: () => Promise<void>
  clearAuthError: () => void
} = {
  loading: false,
  session: null,
  authError: null,
  allowedEmailDomain: 'theaccessgroup.com',
  signInWithMicrosoft,
  clearAuthError,
}

mock.module('../../supabaseClient', () => ({
  supabase: {},
}))

mock.module('../../lib/useAuth', () => ({
  useAuth: () => authState,
}))

mock.module('../../lib/authFlags', () => ({
  isMicrosoftLoginEnabled: () => microsoftLoginEnabled.value,
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
  signInWithMicrosoft.mockClear()
  fetchPinSession.mockReset()
  fetchPinSession.mockImplementation(async () => ({ authenticated: false, role: null, configured: true }))
  submitPin.mockClear()
  logoutPinSession.mockClear()
  cachePinRole.mockClear()
  microsoftLoginEnabled.value = false

  authState.loading = false
  authState.session = null
  authState.authError = null
  authState.allowedEmailDomain = 'theaccessgroup.com'
  authState.signInWithMicrosoft = signInWithMicrosoft
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

  test('shows Microsoft button disabled when feature flag is off', async () => {
    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    const microsoftButton = await screen.findByRole('button', { name: 'Sign in with Microsoft' })
    expect(microsoftButton).toBeDisabled()
    expect(screen.getByText('Microsoft login is temporarily disabled while tenant approval is pending.')).toBeInTheDocument()
  })

  test('enables Microsoft sign-in when feature flag is on', async () => {
    microsoftLoginEnabled.value = true

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    const microsoftButton = await screen.findByRole('button', { name: 'Sign in with Microsoft' })
    expect(microsoftButton).not.toBeDisabled()

    act(() => {
      microsoftButton.click()
    })

    expect(signInWithMicrosoft).toHaveBeenCalled()
    expect(screen.getByText('Temporary PIN access is available for approved admin/team users while Microsoft approval is pending.')).toBeInTheDocument()
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
