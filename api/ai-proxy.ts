const ALLOWED_HEADERS = 'Content-Type, x-target-url, api-key, ocp-apim-subscription-key, authorization'
const DEFAULT_ALLOWED_TARGET_HOSTS = ['api.openai.com', '*.openai.azure.com', '*.azure-api.net']

function toSingleHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function getRequestOrigin(req: any): string {
  const host = toSingleHeader(req.headers.host)
  if (!host) return ''
  const forwardedProto = toSingleHeader(req.headers['x-forwarded-proto'])
  const protocol = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${protocol}://${host}`
}

function isSameOriginBrowserRequest(req: any): boolean {
  const origin = toSingleHeader(req.headers.origin)
  if (!origin) return process.env.NODE_ENV !== 'production'
  const requestOrigin = getRequestOrigin(req)
  if (!requestOrigin) return false
  try {
    return new URL(origin).origin === new URL(requestOrigin).origin
  } catch {
    return false
  }
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

function parseAllowedHosts(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
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

function validateTargetUrl(rawTargetUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  let target: URL
  try {
    target = new URL(rawTargetUrl)
  } catch {
    return { ok: false, error: 'Invalid x-target-url value' }
  }

  const isDevelopment = process.env.NODE_ENV !== 'production'
  const isProduction = !isDevelopment
  const protocol = target.protocol.toLowerCase()
  const hostname = target.hostname.toLowerCase()
  const isLocalDevHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  const configuredAllowedHosts = parseAllowedHosts(process.env.AI_PROXY_ALLOWED_HOSTS)
  const allowedHosts = configuredAllowedHosts.length > 0 ? configuredAllowedHosts : DEFAULT_ALLOWED_TARGET_HOSTS

  if (target.username || target.password) {
    return { ok: false, error: 'Credentials in x-target-url are not allowed' }
  }
  if (protocol !== 'https:' && !(isDevelopment && protocol === 'http:' && isLocalDevHost)) {
    return { ok: false, error: 'Only HTTPS targets are allowed' }
  }
  if (isBlockedHostname(hostname) && !(isDevelopment && isLocalDevHost)) {
    return { ok: false, error: 'Target host is not allowed' }
  }
  if (isProduction && !allowedHosts.some((pattern) => hostMatchesPattern(hostname, pattern))) {
    return { ok: false, error: 'Target host is not in the proxy allowlist' }
  }

  return { ok: true, url: target.toString() }
}

function setCorsHeaders(req: any, res: any): void {
  const requestOrigin = getRequestOrigin(req)
  res.setHeader('Access-Control-Allow-Origin', requestOrigin || 'null')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  res.setHeader('Vary', 'Origin')
}

export default async function handler(req: any, res: any): Promise<void> {
  if (!isSameOriginBrowserRequest(req)) {
    setCorsHeaders(req, res)
    res.status(403).json({ error: 'Forbidden origin' })
    return
  }

  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res)
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const targetUrl = toSingleHeader(req.headers['x-target-url'])
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing x-target-url header' })
    return
  }
  const validatedTarget = validateTargetUrl(targetUrl)
  if (!validatedTarget.ok) {
    res.status(400).json({ error: validatedTarget.error })
    return
  }

  const fwdHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  const authHeaderMap: Record<string, string> = {
    'api-key': 'api-key',
    'ocp-apim-subscription-key': 'Ocp-Apim-Subscription-Key',
    authorization: 'Authorization',
  }

  for (const [headerName, mappedName] of Object.entries(authHeaderMap)) {
    const headerValue = toSingleHeader(req.headers[headerName])
    if (headerValue) fwdHeaders[mappedName] = headerValue
  }

  const upstreamBody =
    req.body == null
      ? undefined
      : typeof req.body === 'string' || req.body instanceof Uint8Array
        ? req.body
        : JSON.stringify(req.body)

  try {
    const upstream = await fetch(validatedTarget.url, {
      method: 'POST',
      headers: fwdHeaders,
      body: upstreamBody,
    })

    setCorsHeaders(req, res)
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')

    const data = await upstream.text()
    res.send(data)
  } catch (error) {
    setCorsHeaders(req, res)
    const message = error instanceof Error ? error.message : String(error)
    res.status(502).json({ error: `Proxy error: ${message}` })
  }
}
