import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const COOKIE_NAME = 'mushi_pin_session'
const MAX_AGE = 60 * 60 * 12

/** Emulates the Vercel /api/auth/* serverless functions during local dev. */
function pinAuthDevPlugin() {
  let env = {}

  return {
    name: 'pin-auth-dev',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, '')
    },
    configureServer(server) {
      const getPin = (key) => (env[key] || '').trim()

      // GET /api/auth/session
      server.middlewares.use('/api/auth/session', async (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return }

        const teamPin = getPin('TEAM_PIN')
        const godPin = getPin('GOD_PIN')
        const configured = Boolean(teamPin || godPin)
        const secret = getPin('PIN_SESSION_SECRET')

        let authenticated = false
        let role = null

        if (secret && configured) {
          const { jwtVerify } = await import('jose')
          const cookie = await import('cookie')
          const cookies = cookie.parse(req.headers.cookie || '')
          const token = cookies[COOKIE_NAME]
          if (token) {
            try {
              const v = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
              const r = v.payload.role
              if (r === 'team' || r === 'god') { authenticated = true; role = r }
            } catch { /* expired / invalid */ }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ authenticated, role, configured }))
      })

      // POST /api/auth/pin
      server.middlewares.use('/api/auth/pin', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return }

        const secret = getPin('PIN_SESSION_SECRET')
        if (!secret) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing PIN_SESSION_SECRET in .env' }))
          return
        }

        const teamPin = getPin('TEAM_PIN')
        const godPin = getPin('GOD_PIN')
        if (!teamPin && !godPin) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'PIN access is not configured.' }))
          return
        }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        let body = {}
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { /* ignore */ }
        const enteredPin = (typeof body.pin === 'string' ? body.pin : '').trim()

        if (!enteredPin) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'PIN is required.' }))
          return
        }

        let role = null
        if (godPin && enteredPin === godPin) role = 'god'
        else if (teamPin && enteredPin === teamPin) role = 'team'

        if (!role) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Wrong PIN. Try again.' }))
          return
        }

        const { SignJWT } = await import('jose')
        const cookie = await import('cookie')
        const token = await new SignJWT({ role })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime(`${MAX_AGE}s`)
          .sign(new TextEncoder().encode(secret))

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie.serialize(COOKIE_NAME, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: MAX_AGE }),
        })
        res.end(JSON.stringify({ role }))
      })

      // POST /api/auth/logout
      server.middlewares.use('/api/auth/logout', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const cookie = await import('cookie')
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie.serialize(COOKIE_NAME, '', { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 0 }),
        })
        res.end(JSON.stringify({ success: true }))
      })
    },
  }
}

/** Lightweight dev proxy to avoid CORS when calling AI provider APIs from the browser. */
function aiProxyPlugin() {
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-proxy', async (req, res) => {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-target-url, api-key, ocp-apim-subscription-key, authorization',
          })
          res.end()
          return
        }

        const targetUrl = req.headers['x-target-url']
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing x-target-url header' }))
          return
        }

        // Read request body
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = Buffer.concat(chunks)

        // Forward auth headers with proper casing
        const fwdHeaders = { 'Content-Type': 'application/json' }
        const headerMap = {
          'api-key': 'api-key',
          'ocp-apim-subscription-key': 'Ocp-Apim-Subscription-Key',
          'authorization': 'Authorization',
        }
        for (const [k, v] of Object.entries(req.headers)) {
          const mapped = headerMap[k.toLowerCase()]
          if (mapped) fwdHeaders[mapped] = v
        }

        try {
          const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: fwdHeaders,
            body: body.length ? body : undefined,
          })
          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          const data = Buffer.from(await upstream.arrayBuffer())
          res.end(data)
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), pinAuthDevPlugin(), aiProxyPlugin()],
  base: '/',
})
