import { consumeSlidingWindowLimit } from '../_rateLimit.js'
import { getClientIp, isSameOriginBrowserRequest } from '../_request.js'

// Vercel executes API routes in Node ESM, which requires explicit .js extensions at runtime.

const DEFAULT_BACKLOG_WEBHOOK_URL = 'https://n8n.dev.ax.accessacloud.com/webhook/bug-to-backlog'
const DEFAULT_ALLOWED_TARGET_HOSTS = ['n8n.dev.ax.accessacloud.com']
const VALID_SEVERITIES = new Set(['critical', 'high', 'low'])

interface BacklogAttachment {
  name: string
  url: string
  type: string
}

interface BacklogPublishPayload {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'low'
  tester: string
  page: string
  device: string
  category: string
  attachments: BacklogAttachment[]
  request_devin: boolean
}

function parseIntegerEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseAllowedHosts(value: string | undefined): string[] {
  if (!value) return []

  return value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false
  if (parts[0] === 10) return true
  if (parts[0] === 127) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!normalized) return true
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true
  if (normalized.endsWith('.local')) return true
  if (normalized === '::1') return true

  if (normalized.includes(':')) {
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true
    return false
  }

  return isPrivateIpv4(normalized)
}

function hostMatchesPattern(hostname: string, pattern: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  const normalizedPattern = pattern.toLowerCase()
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1)
    return normalizedHost.endsWith(suffix)
  }
  return normalizedHost === normalizedPattern
}

function validateWebhookUrl(rawWebhookUrl: string, allowedHosts: string[]): { ok: true; url: string } | { ok: false; error: string } {
  let target: URL
  try {
    target = new URL(rawWebhookUrl)
  } catch {
    return { ok: false, error: 'Invalid BACKLOG_WEBHOOK_URL.' }
  }

  if (target.protocol.toLowerCase() !== 'https:') {
    return { ok: false, error: 'BACKLOG_WEBHOOK_URL must use https.' }
  }

  const hostname = target.hostname.toLowerCase()
  if (isBlockedHostname(hostname)) {
    return { ok: false, error: 'BACKLOG_WEBHOOK_URL host is not allowed.' }
  }

  if (!allowedHosts.some((pattern) => hostMatchesPattern(hostname, pattern))) {
    return { ok: false, error: 'BACKLOG_WEBHOOK_URL host is not in BACKLOG_ALLOWED_HOSTS.' }
  }

  return { ok: true, url: target.toString() }
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

  if (typeof body === 'object') {
    return body as Record<string, unknown>
  }

  return {}
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function takeString(value: unknown, maxLength: number): string {
  return asTrimmedString(value).slice(0, maxLength)
}

function parseAttachments(value: unknown): BacklogAttachment[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 25).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []

    const record = entry as Record<string, unknown>
    const name = takeString(record.name, 200)
    const url = takeString(record.url, 2_000)
    const type = takeString(record.type, 200)

    if (!name || !url) return []
    return [{ name, url, type }]
  })
}

function validatePayload(body: Record<string, unknown>): { ok: true; payload: BacklogPublishPayload } | { ok: false; error: string } {
  const id = takeString(body.id, 120)
  const title = takeString(body.title, 500)
  const severity = takeString(body.severity, 20)

  if (!id) return { ok: false, error: 'Bug id is required.' }
  if (!title) return { ok: false, error: 'Bug title is required.' }
  if (!VALID_SEVERITIES.has(severity)) return { ok: false, error: 'Bug severity is invalid.' }

  const payload: BacklogPublishPayload = {
    id,
    title,
    description: takeString(body.description, 20_000),
    severity: severity as 'critical' | 'high' | 'low',
    tester: takeString(body.tester, 300),
    page: takeString(body.page, 500),
    device: takeString(body.device, 500),
    category: takeString(body.category, 300),
    attachments: parseAttachments(body.attachments),
    request_devin: Boolean(body.request_devin),
  }

  return { ok: true, payload }
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  if (!isSameOriginBrowserRequest(req)) {
    res.status(403).json({ success: false, error: 'Forbidden origin' })
    return
  }

  const publishRateLimitMax = parseIntegerEnv(process.env.PUBLISH_RATE_LIMIT_MAX, 20)
  const publishRateLimitWindowSeconds = parseIntegerEnv(process.env.PUBLISH_RATE_LIMIT_WINDOW_SECONDS, 60)

  const sourceIp = getClientIp(req)
  const rateLimit = consumeSlidingWindowLimit({
    namespace: 'backlog-publish',
    key: sourceIp,
    limit: publishRateLimitMax,
    windowMs: publishRateLimitWindowSeconds * 1000,
  })

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    res.status(429).json({ success: false, error: 'Too many publish attempts. Please try again shortly.' })
    console.warn('[backlog/publish] rate limit triggered', { sourceIp, retryAfterSeconds: rateLimit.retryAfterSeconds })
    return
  }

  const payloadResult = validatePayload(parseBody(req.body))
  if (!payloadResult.ok) {
    res.status(400).json({ success: false, error: payloadResult.error })
    return
  }

  const webhookUrl = (process.env.BACKLOG_WEBHOOK_URL ?? DEFAULT_BACKLOG_WEBHOOK_URL).trim()
  const configuredAllowedHosts = parseAllowedHosts(process.env.BACKLOG_ALLOWED_HOSTS)
  const allowedHosts = configuredAllowedHosts.length > 0 ? configuredAllowedHosts : DEFAULT_ALLOWED_TARGET_HOSTS

  const validatedWebhook = validateWebhookUrl(webhookUrl, allowedHosts)
  if (!validatedWebhook.ok) {
    res.status(500).json({ success: false, error: validatedWebhook.error })
    return
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const webhookSecret = (process.env.BACKLOG_WEBHOOK_SECRET ?? '').trim()
  if (webhookSecret) {
    const headerName = (process.env.BACKLOG_WEBHOOK_SECRET_HEADER ?? 'x-mushi-webhook-secret').trim() || 'x-mushi-webhook-secret'
    headers[headerName] = webhookSecret
  }

  try {
    const upstream = await fetch(validatedWebhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadResult.payload),
    })

    const data = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    res.send(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(502).json({ success: false, error: `Publish proxy error: ${message}` })
  }
}
