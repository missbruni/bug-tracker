import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function loadLocalEnvFile(root) {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return {}
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
}

function getLocalLogoAttachment(root) {
  const logoPath = path.join(root, 'public', 'mushi-logo-email.png')
  if (!fs.existsSync(logoPath)) return null
  return {
    content: fs.readFileSync(logoPath),
    filename: 'mushi-logo-email.png',
    contentType: 'image/png',
    contentId: 'mushi-logo',
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
  let logoAttachment = null

  return {
    name: 'invite-dev',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, '')
      logoAttachment = getLocalLogoAttachment(config.root)
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
        const allowedDomains = (env.ALLOWED_EMAIL_DOMAIN || env.VITE_ALLOWED_EMAIL_DOMAIN || '')
          .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
        if (allowedDomains.length === 0) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'ALLOWED_EMAIL_DOMAIN is not configured in .env' }))
          return
        }
        const emailDomain = email.split('@')[1]
        if (!allowedDomains.some((d) => d === emailDomain)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Only @${allowedDomains.join(' / @')} emails can be invited.` }))
          return
        }

        // Authenticate caller via Supabase
        const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
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
            const appUrl = env.APP_URL || 'https://mushi.vercel.app'
            const assetBaseUrl = env.EMAIL_ASSET_BASE_URL || appUrl
            const logoUrl = logoAttachment ? 'cid:mushi-logo' : undefined
            const fromAddress = env.INVITE_FROM_EMAIL || 'Mushi <onboarding@resend.dev>'
            const inviterName = userData.user.user_metadata?.name || userData.user.user_metadata?.full_name || 'A team admin'

            const result = await resend.emails.send({
              from: fromAddress,
              to: [email],
              subject: `You're invited to join ${teamName} on Mushi`,
              html: (await import('./api/_inviteEmail.ts')).buildInviteEmailHtml({ inviterName, teamName, appUrl, assetBaseUrl, logoUrl }),
              ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
            })
            if (result.error) throw new Error(result.error.message)
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

function mentionDevPlugin() {
  let env = {}
  let logoAttachment = null

  return {
    name: 'mention-dev',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...loadLocalEnvFile(config.root) }
      logoAttachment = getLocalLogoAttachment(config.root)
    },
    configureServer(server) {
      server.middlewares.use('/api/bug-comment-mention', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        let body = {}
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { /* ignore */ }

        const bugId = (typeof body.bugId === 'string' ? body.bugId : '').trim()
        const commentId = typeof body.commentId === 'number' ? body.commentId : Number(body.commentId)
        const mentionedUserIds = Array.isArray(body.mentionedUserIds)
          ? [...new Set(body.mentionedUserIds.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
          : []

        if (!bugId || !Number.isFinite(commentId) || mentionedUserIds.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'bugId, commentId, and mentionedUserIds are required.' }))
          return
        }

        const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
        const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
        const supabaseKey = serviceKey || anonKey
        if (!supabaseUrl || !supabaseKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured in .env' }))
          return
        }

        const authHeader = req.headers.authorization || ''
        const token = authHeader.replace(/^Bearer\s+/i, '').trim()
        if (!token) {
          console.warn('[mention-dev] missing Authorization bearer token')
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized: missing bearer token.' }))
          return
        }

        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(
          supabaseUrl,
          supabaseKey,
          serviceKey ? undefined : { global: { headers: { Authorization: `Bearer ${token}` } } },
        )

        const { data: userData, error: authError } = await sb.auth.getUser(token)
        if (authError || !userData.user) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized.' }))
          return
        }

        const [bugRes, commentRes] = await Promise.all([
          sb.from('bugs').select('id, title, team_id').eq('id', bugId).single(),
          sb.from('comments').select('id, bug_id, team_id, text, mentioned_user_ids').eq('id', commentId).single(),
        ])
        if (bugRes.error || !bugRes.data || commentRes.error || !commentRes.data || commentRes.data.bug_id !== bugId) {
          console.warn('[mention-dev] bug/comment lookup failed:', {
            bugError: bugRes.error?.message,
            hasBug: Boolean(bugRes.data),
            commentError: commentRes.error?.message,
            hasComment: Boolean(commentRes.data),
            commentBugId: commentRes.data?.bug_id,
            expectedBugId: bugId,
          })
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            error: 'Bug comment not found.',
          }))
          return
        }

        const storedMentionedIds = new Set(commentRes.data.mentioned_user_ids || [])
        const { data: members, error: membersError } = await sb
          .from('team_members')
          .select('user_id')
          .eq('team_id', bugRes.data.team_id)
          .eq('status', 'active')
          .in('user_id', mentionedUserIds)
        if (membersError) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to validate mentioned users.' }))
          return
        }

        const validMentionedIds = (members || [])
          .map((member) => member.user_id)
          .filter((userId) => storedMentionedIds.has(userId))
        if (validMentionedIds.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, sent: 0 }))
          return
        }

        const resendKey = env.RESEND_API_KEY || ''
        if (!resendKey) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, sent: 0, warning: 'RESEND_API_KEY is not configured.' }))
          return
        }

        const { data: orgUsers } = await sb.rpc('get_org_users')
        const usersById = new Map((orgUsers || []).map((user) => [user.id, user]))
        const { Resend } = await import('resend')
        const resend = new Resend(resendKey)
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host?.startsWith('localhost') || req.headers.host?.startsWith('127.0.0.1') ? 'http' : 'https')
        const appUrl = env.APP_URL || `${protocol}://${req.headers.host || 'localhost:5173'}`
        const assetBaseUrl = env.EMAIL_ASSET_BASE_URL || appUrl
        const logoUrl = logoAttachment ? 'cid:mushi-logo' : undefined
        const fromAddress = env.MENTION_FROM_EMAIL || env.INVITE_FROM_EMAIL || 'Mushi <onboarding@resend.dev>'
        const actorName = userData.user?.user_metadata?.name || userData.user?.user_metadata?.full_name || userData.user?.email?.split('@')[0] || 'Someone'

        let sent = 0
        const emailErrors = []
        const emailIds = []
        for (const userId of validMentionedIds) {
          const recipient = usersById.get(userId)
          if (!recipient?.email) continue
          try {
            const result = await resend.emails.send({
              from: fromAddress,
              to: [recipient.email],
              subject: `${actorName} mentioned you on ${bugRes.data.id}`,
              html: (await import('./api/_mentionEmail.ts')).buildBugMentionEmailHtml({
                actorName,
                bugId: bugRes.data.id,
                bugTitle: bugRes.data.title,
                commentText: commentRes.data.text,
                bugUrl: `${appUrl}/?q=${encodeURIComponent(bugRes.data.id)}`,
                appUrl,
                assetBaseUrl,
                logoUrl,
              }),
              ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
            })
            if (result.error) throw new Error(result.error.message)
            if (result.data?.id) emailIds.push(result.data.id)
            sent += 1
          } catch (emailErr) {
            console.warn('[mention-dev] email send failed:', emailErr)
            emailErrors.push(emailErr instanceof Error ? emailErr.message : 'Email send failed')
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          sent,
          emailIds,
          warning: emailErrors.length ? emailErrors.join('; ') : undefined,
        }))
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
    aiProxyPlugin(),
    inviteDevPlugin(),
    mentionDevPlugin(),
  ],
  base: '/',
})
