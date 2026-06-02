import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isSameOriginBrowserRequest, toSingleHeader } from './_request.js'
import { buildBugMentionEmailHtml } from './_mentionEmail.js'

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Record<string, unknown> } catch { return {} }
  }
  return typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

function getUserDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const metadata = user?.user_metadata ?? {}
  const name = metadata.name || metadata.full_name || metadata.preferred_username
  if (typeof name === 'string' && name.trim()) return name.trim()
  const email = user?.email ?? ''
  const localPart = email.split('@')[0] || 'Someone'
  return localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

async function getCaller(req: any) {
  const sb = getServiceSupabase()
  if (!sb) return null

  const authHeader = toSingleHeader(req.headers?.authorization)
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

async function canAccessTeam(teamId: string, userId: string): Promise<boolean> {
  const sb = getServiceSupabase()
  if (!sb) return false

  const { data: ownerRow } = await sb
    .from('app_owners')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  if (ownerRow) return true

  const { data: memberRow } = await sb
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  return Boolean(memberRow)
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

  const caller = await getCaller(req)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  const body = parseBody(req.body)
  const bugId = typeof body.bugId === 'string' ? body.bugId.trim() : ''
  const commentId = typeof body.commentId === 'number' ? body.commentId : Number(body.commentId)
  const mentionedUserIds = Array.isArray(body.mentionedUserIds)
    ? Array.from(new Set(body.mentionedUserIds.filter((value): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim())))
    : []

  if (!bugId || !Number.isFinite(commentId) || mentionedUserIds.length === 0) {
    res.status(400).json({ error: 'bugId, commentId, and mentionedUserIds are required.' })
    return
  }

  const [bugRes, commentRes] = await Promise.all([
    sb.from('bugs').select('id, title, team_id').eq('id', bugId).single(),
    sb.from('comments').select('id, bug_id, team_id, text, mentioned_user_ids').eq('id', commentId).single(),
  ])

  if (bugRes.error || !bugRes.data || commentRes.error || !commentRes.data || commentRes.data.bug_id !== bugId) {
    res.status(404).json({ error: 'Bug comment not found.' })
    return
  }

  const bug = bugRes.data as { id: string; title: string; team_id: string }
  const comment = commentRes.data as { id: number; bug_id: string; team_id: string; text: string; mentioned_user_ids?: string[] | null }
  if (comment.team_id !== bug.team_id) {
    res.status(400).json({ error: 'Comment does not belong to the bug team.' })
    return
  }

  if (!(await canAccessTeam(bug.team_id, caller.id))) {
    res.status(403).json({ error: 'Forbidden.' })
    return
  }

  const { data: members, error: membersError } = await sb
    .from('team_members')
    .select('user_id')
    .eq('team_id', bug.team_id)
    .eq('status', 'active')
    .in('user_id', mentionedUserIds)

  if (membersError) {
    res.status(500).json({ error: 'Failed to validate mentioned users.' })
    return
  }

  const storedMentionedIds = new Set(comment.mentioned_user_ids || [])
  const validMentionedIds = ((members || []) as Array<{ user_id: string }>)
    .map((member) => member.user_id)
    .filter((userId) => storedMentionedIds.has(userId))

  if (validMentionedIds.length === 0) {
    res.status(200).json({ success: true, sent: 0 })
    return
  }

  const resendKey = process.env.RESEND_API_KEY ?? ''
  if (!resendKey) {
    res.status(200).json({ success: true, sent: 0 })
    return
  }

  const appUrl = process.env.APP_URL ?? 'https://mushi.vercel.app'
  const assetBaseUrl = process.env.EMAIL_ASSET_BASE_URL ?? appUrl
  const fromAddress = process.env.MENTION_FROM_EMAIL ?? process.env.INVITE_FROM_EMAIL ?? 'Mushi <onboarding@resend.dev>'
  const bugUrl = `${appUrl}/?q=${encodeURIComponent(bug.id)}`
  const resend = new Resend(resendKey)
  const actorName = getUserDisplayName({ email: caller.email, user_metadata: caller.user_metadata as Record<string, unknown> })

  let sent = 0
  const emailErrors: string[] = []
  const emailIds: string[] = []
  for (const userId of validMentionedIds) {
    const { data } = await sb.auth.admin.getUserById(userId)
    const recipientEmail = data.user?.email
    if (!recipientEmail) continue

    try {
      const result = await resend.emails.send({
        from: fromAddress,
        to: [recipientEmail],
        subject: `${actorName} mentioned you on ${bug.id}`,
        html: buildBugMentionEmailHtml({
          actorName,
          bugId: bug.id,
          bugTitle: bug.title,
          commentText: comment.text,
          bugUrl,
          appUrl,
          assetBaseUrl,
        }),
      })
      if (result.error) {
        throw new Error(result.error.message)
      }
      if (result.data?.id) emailIds.push(result.data.id)
      sent += 1
    } catch (emailError) {
      console.warn('[bug-comment-mention] email send failed:', emailError)
      emailErrors.push(emailError instanceof Error ? emailError.message : 'Email send failed')
    }
  }

  res.status(200).json({
    success: true,
    sent,
    emailIds,
    warning: emailErrors.length ? emailErrors.join('; ') : undefined,
  })
}
