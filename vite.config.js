import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react(), aiProxyPlugin()],
  base: '/',
})
