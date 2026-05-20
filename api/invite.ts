import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isSameOriginBrowserRequest, toSingleHeader } from './_request.js'

const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? 'theaccessgroup.com').trim().toLowerCase()

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Record<string, unknown> } catch { return {} }
  }
  return typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

function isValidOrgEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false
  const domain = email.split('@')[1]?.toLowerCase()
  return domain === ALLOWED_EMAIL_DOMAIN
}

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function getCallerUserId(req: any): Promise<string | null> {
  const sb = getServiceSupabase()
  if (!sb) return null

  const authHeader = toSingleHeader(req.headers?.authorization)
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

async function isCallerTeamAdmin(teamId: string, userId: string): Promise<boolean> {
  const sb = getServiceSupabase()
  if (!sb) return false

  // Check app_owners first
  const { data: ownerRow } = await sb
    .from('app_owners')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  if (ownerRow) return true

  // Check team_admin role
  const { data: memberRow } = await sb
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  return memberRow?.role === 'team_admin'
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isSameOriginBrowserRequest(req)) {
    res.status(403).json({ error: 'Forbidden origin' })
    return
  }

  const sb = getServiceSupabase()
  if (!sb) {
    res.status(500).json({ error: 'Server configuration error.' })
    return
  }

  // Authenticate caller
  const userId = await getCallerUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  const body = parseBody(req.body)
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!teamId) {
    res.status(400).json({ error: 'teamId is required.' })
    return
  }
  if (!isValidOrgEmail(email)) {
    res.status(400).json({ error: `Only @${ALLOWED_EMAIL_DOMAIN} emails can be invited.` })
    return
  }

  // Verify caller is team admin
  const admin = await isCallerTeamAdmin(teamId, userId)
  if (!admin) {
    res.status(403).json({ error: 'Only team admins can invite members.' })
    return
  }

  // Check if already a team member
  const { data: existingUsers } = await sb.rpc('get_org_users')
  const existingUser = (existingUsers as Array<{ id: string; email: string }> | null)
    ?.find((u) => u.email.toLowerCase() === email)
  if (existingUser) {
    const { data: existingMember } = await sb
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', existingUser.id)
      .eq('status', 'active')
      .single()
    if (existingMember) {
      res.status(409).json({ error: 'This user is already a team member.' })
      return
    }
  }

  // Check if already invited
  const { data: existingInvite } = await sb
    .from('team_invitations')
    .select('id')
    .eq('team_id', teamId)
    .eq('email', email)
    .eq('status', 'pending')
    .single()
  if (existingInvite) {
    res.status(409).json({ error: 'An invitation has already been sent to this email.' })
    return
  }

  // Get team name and inviter name for email
  const [teamRes, inviterRes] = await Promise.all([
    sb.from('teams').select('name').eq('id', teamId).single(),
    sb.auth.admin.getUserById(userId),
  ])
  const teamName = teamRes.data?.name ?? 'the team'
  const inviterMeta = inviterRes.data?.user?.user_metadata as Record<string, string> | undefined
  const inviterName = inviterMeta?.name || inviterMeta?.full_name || inviterMeta?.preferred_username || 'A team admin'

  // Insert invitation
  const { error: insertError } = await sb
    .from('team_invitations')
    .insert({ team_id: teamId, email, role: 'member', invited_by: userId })
  if (insertError) {
    res.status(500).json({ error: 'Failed to create invitation.' })
    return
  }

  // Send email via Resend
  const resendKey = process.env.RESEND_API_KEY ?? ''
  if (resendKey) {
    const resend = new Resend(resendKey)
    const appUrl = process.env.APP_URL ?? 'https://mushi.vercel.app'
    const fromAddress = process.env.INVITE_FROM_EMAIL ?? 'Mushi <onboarding@resend.dev>'

    try {
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
    } catch (emailError) {
      console.warn('[invite] email send failed:', emailError)
      // Invitation was still created — don't fail the request
    }
  }

  res.status(200).json({ success: true })
}
