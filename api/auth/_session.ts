import { SignJWT, jwtVerify } from 'jose'
import * as cookie from 'cookie'

type PinAccessLevel = 'team' | 'god'

const PIN_SESSION_COOKIE = 'mushi_pin_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

function getEnv(name: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return (env?.[name] ?? '').trim()
}

function isPinAccessLevel(value: unknown): value is PinAccessLevel {
  return value === 'team' || value === 'god'
}

function toSingleHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function toSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export function getConfiguredPins(): {
  teamPin: string
  godPin: string
  configured: boolean
} {
  const teamPin = getEnv('TEAM_PIN')
  const godPin = getEnv('GOD_PIN')
  return {
    teamPin,
    godPin,
    configured: Boolean(teamPin || godPin),
  }
}

export function getSessionSecret(): string {
  return getEnv('PIN_SESSION_SECRET')
}

export function isSecureRequest(req: any): boolean {
  const forwardedProto = toSingleHeader(req?.headers?.['x-forwarded-proto']).toLowerCase()
  return forwardedProto === 'https'
}

export function buildSessionCookie(token: string, secure: boolean): string {
  return cookie.serialize(PIN_SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function buildClearSessionCookie(secure: boolean): string {
  return cookie.serialize(PIN_SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 0,
  })
}

export async function createSessionToken(role: PinAccessLevel, secret: string): Promise<string> {
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(toSecretKey(secret))
}

export async function readSessionFromRequest(
  req: any,
  secret: string,
): Promise<{ authenticated: boolean; role: PinAccessLevel | null }> {
  const cookieHeader = toSingleHeader(req?.headers?.cookie)
  const cookies = cookie.parse(cookieHeader || '')
  const token = cookies[PIN_SESSION_COOKIE]

  if (!token) {
    return { authenticated: false, role: null }
  }

  try {
    const verified = await jwtVerify(token, toSecretKey(secret), {
      algorithms: ['HS256'],
    })

    const roleCandidate = typeof verified.payload.role === 'string' ? verified.payload.role : null
    if (!isPinAccessLevel(roleCandidate)) {
      return { authenticated: false, role: null }
    }

    return { authenticated: true, role: roleCandidate }
  } catch {
    return { authenticated: false, role: null }
  }
}
