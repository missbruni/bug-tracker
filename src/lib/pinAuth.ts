import { PIN_ROLE_SESSION_KEY, PIN_SESSION_KEY, isPinAccessLevel, type PinAccessLevel } from './teamScope'

interface PinSessionResponse {
  authenticated: boolean
  role: PinAccessLevel | null
  configured: boolean
}

function getCachedPinRole(): PinAccessLevel | null {
  if (typeof window === 'undefined') return null
  const role = sessionStorage.getItem(PIN_ROLE_SESSION_KEY)
  return isPinAccessLevel(role) ? role : null
}

export async function fetchPinSession(): Promise<PinSessionResponse> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch PIN session (${response.status})`)
    }

    const json = (await response.json()) as {
      authenticated?: unknown
      role?: unknown
      configured?: unknown
    }

    const roleCandidate = typeof json.role === 'string' ? json.role : null
    const role = isPinAccessLevel(roleCandidate) ? roleCandidate : null

    return {
      authenticated: Boolean(json.authenticated) && role !== null,
      role,
      configured: Boolean(json.configured),
    }
  } catch (error) {
    if (!import.meta.env.DEV) throw error

    const cachedRole = getCachedPinRole()
    return {
      authenticated: cachedRole !== null,
      role: cachedRole,
      configured: false,
    }
  }
}

export async function submitPin(pin: string): Promise<{ role: PinAccessLevel }> {
  try {
    const response = await fetch('/api/auth/pin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      role?: unknown
      error?: unknown
    }

    if (!response.ok) {
      const message = typeof payload.error === 'string' ? payload.error : 'Failed to verify PIN.'
      throw new Error(message)
    }

    const roleCandidate = typeof payload.role === 'string' ? payload.role : null
    if (!isPinAccessLevel(roleCandidate)) {
      throw new Error('Invalid PIN role returned by server.')
    }

    return { role: roleCandidate }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Failed to verify PIN.')
  }
}

export async function logoutPinSession(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined)
}

export function cachePinRole(role: PinAccessLevel | null): void {
  if (typeof window === 'undefined') return

  if (role) {
    sessionStorage.setItem(PIN_SESSION_KEY, 'true')
    sessionStorage.setItem(PIN_ROLE_SESSION_KEY, role)
    return
  }

  sessionStorage.removeItem(PIN_SESSION_KEY)
  sessionStorage.removeItem(PIN_ROLE_SESSION_KEY)
}
