import { getConfiguredPins, getSessionSecret, readSessionFromRequest } from './_session.js'

// Vercel executes API routes in Node ESM, which requires explicit .js extensions at runtime.

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed')
    return
  }

  const { configured } = getConfiguredPins()
  const secret = getSessionSecret()

  if (!secret || !configured) {
    res.status(200).json({ authenticated: false, role: null, configured })
    return
  }

  const session = await readSessionFromRequest(req, secret)
  res.status(200).json({
    authenticated: session.authenticated,
    role: session.role,
    configured,
  })
}
