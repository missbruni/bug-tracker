const ALLOWED_ORIGINS = [
  'https://missbruni.github.io',
  'http://localhost:5173',
]

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin') || ''
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ''

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-target-url, api-key, ocp-apim-subscription-key, authorization',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (!corsOrigin) {
      return new Response('Forbidden', { status: 403 })
    }

    const targetUrl = request.headers.get('x-target-url')
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing x-target-url header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Forward auth headers to the upstream API
    const fwdHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    for (const key of ['api-key', 'ocp-apim-subscription-key', 'authorization']) {
      const val = request.headers.get(key)
      if (val) fwdHeaders[key] = val
    }

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: fwdHeaders,
        body: request.body,
      })

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: `Proxy error: ${(err as Error).message}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin },
      })
    }
  },
}
