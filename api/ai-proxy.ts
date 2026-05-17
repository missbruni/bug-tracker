const ALLOWED_HEADERS = 'Content-Type, x-target-url, api-key, ocp-apim-subscription-key, authorization'

function toSingleHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function setCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
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
      : typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body)

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: fwdHeaders,
      body: upstreamBody,
    })

    setCorsHeaders(res)
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')

    const data = Buffer.from(await upstream.arrayBuffer())
    res.send(data)
  } catch (error) {
    setCorsHeaders(res)
    const message = error instanceof Error ? error.message : String(error)
    res.status(502).json({ error: `Proxy error: ${message}` })
  }
}
