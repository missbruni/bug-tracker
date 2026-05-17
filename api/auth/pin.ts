import {
  buildSessionCookie,
  createSessionToken,
  getConfiguredPins,
  getSessionSecret,
  isSecureRequest,
} from './_session.js'

// Vercel executes API routes in Node ESM, which requires explicit .js extensions at runtime.

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
    res.status(401).json({ error: 'Wrong PIN. Try again.' })
    return
  }

  const token = await createSessionToken(role, secret)
  res.setHeader('Set-Cookie', buildSessionCookie(token, isSecureRequest(req)))
  res.status(200).json({ role })
}
