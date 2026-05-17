type PinAccessLevel = 'team' | 'god'

type SessionPayload = {
  role: PinAccessLevel
  exp: number
}

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

function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookieHeader) return result

  for (const raw of cookieHeader.split(';')) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const name = trimmed.slice(0, separatorIndex)
    const value = trimmed.slice(separatorIndex + 1)
    result[name] = decodeURIComponent(value)
  }

  return result
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function safeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toHex(signature)
}

export function getConfiguredPins(): {
  teamPin: string
  godPin: string
  configured: boolean
} {
  const teamPin = getEnv('TEAM_PIN') || getEnv('VITE_TEAM_PIN')
  const godPin = getEnv('GOD_PIN') || getEnv('VITE_GOD_PIN')
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
  const secureFlag = secure ? '; Secure' : ''
  return `${PIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`
}

export function buildClearSessionCookie(secure: boolean): string {
  const secureFlag = secure ? '; Secure' : ''
  return `${PIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
}

export async function createSessionToken(role: PinAccessLevel, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  const payload = encodeURIComponent(JSON.stringify({ role, exp }))
  const signature = await signPayload(secret, payload)
  return `${payload}.${signature}`
}

export async function readSessionFromRequest(
  req: any,
  secret: string,
): Promise<{ authenticated: boolean; role: PinAccessLevel | null }> {
  const cookieHeader = toSingleHeader(req?.headers?.cookie)
  const cookies = parseCookies(cookieHeader)
  const token = cookies[PIN_SESSION_COOKIE]

  if (!token) {
    return { authenticated: false, role: null }
  }

  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex <= 0) {
    return { authenticated: false, role: null }
  }

  const payload = token.slice(0, separatorIndex)
  const providedSignature = token.slice(separatorIndex + 1)
  const expectedSignature = await signPayload(secret, payload)

  if (!safeStringEqual(providedSignature, expectedSignature)) {
    return { authenticated: false, role: null }
  }

  let parsed: SessionPayload | null = null
  try {
    parsed = JSON.parse(decodeURIComponent(payload)) as SessionPayload
  } catch {
    parsed = null
  }

  if (!parsed || !isPinAccessLevel(parsed.role) || typeof parsed.exp !== 'number') {
    return { authenticated: false, role: null }
  }

  const now = Math.floor(Date.now() / 1000)
  if (parsed.exp <= now) {
    return { authenticated: false, role: null }
  }

  return { authenticated: true, role: parsed.role }
}
