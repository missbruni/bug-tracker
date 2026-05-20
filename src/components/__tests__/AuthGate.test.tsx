/// <reference lib="dom" />
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const clearAuthError = mock(() => {})
const signInWithMicrosoft = mock(async () => {})

const authState: {
  loading: boolean
  session: Session | null
  authError: string | null
  allowedEmailDomain: string
  allowedEmailDomains: string[]
  signInWithMicrosoft: () => Promise<void>
  clearAuthError: () => void
} = {
  loading: false,
  session: null,
  authError: null,
  allowedEmailDomain: 'theaccessgroup.com',
  allowedEmailDomains: ['theaccessgroup.com'],
  signInWithMicrosoft,
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
  clearAuthError.mockClear()
  signInWithMicrosoft.mockClear()

  authState.loading = false
  authState.session = null
  authState.authError = null
  authState.allowedEmailDomain = 'theaccessgroup.com'
  authState.signInWithMicrosoft = signInWithMicrosoft
})

afterEach(() => cleanup())

describe('AuthGate', () => {
  test('renders login screen when no session', () => {
    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    expect(screen.getByText('Sign in with your company Microsoft account to continue.')).toBeInTheDocument()
    expect(screen.queryByText('App Content')).not.toBeInTheDocument()
  })

  test('shows Microsoft sign-in button enabled', () => {
    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    const microsoftButton = screen.getByRole('button', { name: 'Sign in with Microsoft' })
    expect(microsoftButton).not.toBeDisabled()

    act(() => {
      microsoftButton.click()
    })

    expect(signInWithMicrosoft).toHaveBeenCalled()
    expect(screen.getByText('Please use your Microsoft account to login.')).toBeInTheDocument()
  })

  test('renders children when session exists', () => {
    authState.session = { user: { email: 'test@theaccessgroup.com' } } as Session

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    expect(screen.getByText('App Content')).toBeInTheDocument()
  })

  test('shows loading state', () => {
    authState.loading = true

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>,
    )

    expect(screen.getByText('Warming up Mushi...')).toBeInTheDocument()
    expect(screen.queryByText('App Content')).not.toBeInTheDocument()
  })
})
