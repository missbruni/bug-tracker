import {
  buildSessionCookie,
  createSessionToken,
  getConfiguredPins,
  getSessionSecret,
  isSecureRequest,
} from './_session.js'
import {
  clearFailureState,
  consumeSlidingWindowLimit,
  getFailureCooldownStatus,
  registerFailureAttempt,
} from '../_rateLimit.js'
import { getClientIp } from '../_request.js'

// Vercel executes API routes in Node ESM, which requires explicit .js extensions at runtime.

function parseIntegerEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof body === 'object') return body as Record<string, unknown>
  return {}
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const sourceIp = getClientIp(req)
  const pinRateLimitMax = parseIntegerEnv(process.env.PIN_RATE_LIMIT_MAX, 25)
  const pinRateLimitWindowSeconds = parseIntegerEnv(process.env.PIN_RATE_LIMIT_WINDOW_SECONDS, 60)
  const failedAttemptsMax = parseIntegerEnv(process.env.PIN_FAILED_ATTEMPTS_MAX, 5)
  const failedAttemptsWindowSeconds = parseIntegerEnv(process.env.PIN_FAILED_ATTEMPTS_WINDOW_SECONDS, 300)
  const failedAttemptsCooldownSeconds = parseIntegerEnv(process.env.PIN_FAILED_COOLDOWN_SECONDS, 600)

  const requestRateLimit = consumeSlidingWindowLimit({
    namespace: 'pin-auth',
    key: sourceIp,
    limit: pinRateLimitMax,
    windowMs: pinRateLimitWindowSeconds * 1000,
  })

  if (!requestRateLimit.allowed) {
    res.setHeader('Retry-After', String(requestRateLimit.retryAfterSeconds))
    res.status(429).json({ error: 'Too many PIN attempts. Please try again shortly.' })
    console.warn('[auth/pin] request rate limit triggered', {
      sourceIp,
      retryAfterSeconds: requestRateLimit.retryAfterSeconds,
    })
    return
  }

  const cooldownStatus = getFailureCooldownStatus('pin-auth-failures', sourceIp)
  if (cooldownStatus.blocked) {
    res.setHeader('Retry-After', String(cooldownStatus.retryAfterSeconds))
    res.status(429).json({ error: 'Too many failed PIN attempts. Please wait before trying again.' })
    return
  }

  const secret = getSessionSecret()
  if (!secret) {
    res.status(500).json({ error: 'PIN auth is not configured (missing PIN_SESSION_SECRET).' })
    return
  }

  const { teamPin, godPin, configured } = getConfiguredPins()
  if (!configured) {
    res.status(503).json({ error: 'PIN access is not configured.' })
    return
  }

  const body = parseBody(req.body)
  const enteredPin = typeof body.pin === 'string' ? body.pin.trim() : ''

  if (!enteredPin) {
    res.status(400).json({ error: 'PIN is required.' })
    return
  }

  let role: 'team' | 'god' | null = null
  if (godPin && enteredPin === godPin) role = 'god'
  else if (teamPin && enteredPin === teamPin) role = 'team'

  if (!role) {
    const failure = registerFailureAttempt({
      namespace: 'pin-auth-failures',
      key: sourceIp,
      maxFailures: failedAttemptsMax,
      failureWindowMs: failedAttemptsWindowSeconds * 1000,
      cooldownMs: failedAttemptsCooldownSeconds * 1000,
    })

    if (failure.triggered) {
      res.setHeader('Retry-After', String(failure.retryAfterSeconds))
      res.status(429).json({ error: 'Too many failed PIN attempts. Please wait before trying again.' })
      console.warn('[auth/pin] failure cooldown triggered', {
        sourceIp,
        retryAfterSeconds: failure.retryAfterSeconds,
      })
      return
    }

    res.status(401).json({ error: 'Wrong PIN. Try again.' })
    return
  }

  clearFailureState('pin-auth-failures', sourceIp)

  const token = await createSessionToken(role, secret)
  res.setHeader('Set-Cookie', buildSessionCookie(token, isSecureRequest(req)))
  res.status(200).json({ role })
}
