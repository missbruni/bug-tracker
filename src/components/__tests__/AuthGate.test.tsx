/// <reference lib="dom" />
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const clearAuthError = mock(() => {})

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

const { default: AuthGate } = await import('../AuthGate')

beforeEach(() => {
  sessionStorage.clear()
  clearAuthError.mockClear()

  authState.loading = false
  authState.session = null
  authState.authError = null
  authState.allowedEmailDomain = 'theaccessgroup.com'
})

afterEach(() => cleanup())

describe('AuthGate', () => {
  test('renders login screen when no session and pin is locked', () => {
    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    expect(screen.getByText('Sign in with your company Microsoft account to continue.')).toBeInTheDocument()
    expect(screen.queryByText('App Content')).not.toBeInTheDocument()
  })

  test('renders children when pin is already unlocked in sessionStorage', () => {
    sessionStorage.setItem('mushi-auth', 'true')

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    expect(screen.getByText('App Content')).toBeInTheDocument()
  })

  test('handles pin-lock event by clearing pin session and returning to login', async () => {
    sessionStorage.setItem('mushi-auth', 'true')

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    expect(screen.getByText('App Content')).toBeInTheDocument()

    window.dispatchEvent(new CustomEvent('pin-lock'))

    await waitFor(() => {
      expect(screen.queryByText('App Content')).not.toBeInTheDocument()
    })

    expect(sessionStorage.getItem('mushi-auth')).toBeNull()
    expect(screen.getByText('Sign in with your company Microsoft account to continue.')).toBeInTheDocument()
  })
})
