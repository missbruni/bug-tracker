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

/** Dev-only handler for POST /api/invite — mirrors api/invite.ts logic. */
function inviteDevPlugin() {
  let env = {}

  return {
    name: 'invite-dev',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, '')
    },
    configureServer(server) {
      server.middlewares.use('/api/invite', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        // Read body
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        let body = {}
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { /* ignore */ }

        const teamId = (typeof body.teamId === 'string' ? body.teamId : '').trim()
        const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase()

        if (!teamId || !email) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'teamId and email are required.' }))
          return
        }

        // Validate domain
        const allowedDomains = (env.ALLOWED_EMAIL_DOMAIN || env.VITE_ALLOWED_EMAIL_DOMAIN || 'theaccessgroup.com')
          .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
        const emailDomain = email.split('@')[1]
        if (!allowedDomains.some((d) => d === emailDomain)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Only @${allowedDomains.join(' / @')} emails can be invited.` }))
          return
        }

        // Authenticate caller via Supabase
        const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in .env' }))
          return
        }

        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(supabaseUrl, serviceKey)

        const authHeader = req.headers.authorization || ''
        const token = authHeader.replace(/^Bearer\s+/i, '').trim()
        if (!token) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized.' }))
          return
        }

        const { data: userData, error: authError } = await sb.auth.getUser(token)
        if (authError || !userData.user) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized.' }))
          return
        }
        const userId = userData.user.id

        // Check admin
        const { data: ownerRow } = await sb.from('app_owners').select('user_id').eq('user_id', userId).single()
        if (!ownerRow) {
          const { data: memberRow } = await sb.from('team_members').select('role').eq('team_id', teamId).eq('user_id', userId).eq('status', 'active').single()
          if (memberRow?.role !== 'team_admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Only team admins can invite members.' }))
            return
          }
        }

        // Check already invited
        const { data: existingInvite } = await sb.from('team_invitations').select('id').eq('team_id', teamId).eq('email', email).eq('status', 'pending').single()
        if (existingInvite) {
          res.writeHead(409, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'An invitation has already been sent to this email.' }))
          return
        }

        // Get team name for email
        const { data: teamRow } = await sb.from('teams').select('name').eq('id', teamId).single()
        const teamName = teamRow?.name ?? 'the team'

        // Insert invitation
        const { error: insertError } = await sb.from('team_invitations').insert({ team_id: teamId, email, role: 'member', invited_by: userId })
        if (insertError) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to create invitation.' }))
          return
        }

        // Send email via Resend (if configured)
        const resendKey = env.RESEND_API_KEY || ''
        if (resendKey) {
          try {
            const { Resend } = await import('resend')
            const resend = new Resend(resendKey)
            const appUrl = env.APP_URL || 'http://localhost:5173'
            const fromAddress = env.INVITE_FROM_EMAIL || 'Mushi <onboarding@resend.dev>'
            const inviterName = userData.user.user_metadata?.name || userData.user.user_metadata?.full_name || 'A team admin'

            await resend.emails.send({
              from: fromAddress,
              to: [email],
              subject: `You're invited to join ${teamName} on Mushi`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
                  <h2 style="margin: 0 0 16px; font-size: 20px; color: #1a1a1a;">You're invited! 🐛</h2>
                  <p style="margin: 0 0 12px; font-size: 15px; color: #444; line-height: 1.5;">
                    <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on Mushi.
                  </p>
                  <p style="margin: 0 0 24px; font-size: 15px; color: #444; line-height: 1.5;">
                    Sign in with your Microsoft account to get started.
                  </p>
                  <a href="${appUrl}" style="display: inline-block; background: #14b8a6; color: #fff; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                    Open Mushi →
                  </a>
                  <p style="margin: 24px 0 0; font-size: 12px; color: #999;">
                    If you weren't expecting this invitation, you can safely ignore this email.
                  </p>
                </div>
              `,
            })
          } catch (emailErr) {
            console.warn('[invite-dev] email send failed:', emailErr)
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      })
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    pinAuthDevPlugin(),
    aiProxyPlugin(),
    inviteDevPlugin(),
  ],
  base: '/',
})
