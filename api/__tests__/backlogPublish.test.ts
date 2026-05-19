import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import handler from '../backlog/publish'

interface MockResponse {
  statusCode: number
  body: unknown
  sent: unknown
  headers: Record<string, string>
  status: (code: number) => MockResponse
  json: (payload: unknown) => MockResponse
  send: (payload: unknown) => MockResponse
  setHeader: (name: string, value: string) => void
}

function createMockResponse(): MockResponse {
  const state = {
    statusCode: 200,
    body: undefined as unknown,
    sent: undefined as unknown,
    headers: {} as Record<string, string>,
  }

  return {
    get statusCode() {
      return state.statusCode
    },
    get body() {
      return state.body
    },
    get sent() {
      return state.sent
    },
    get headers() {
      return state.headers
    },
    status(code: number) {
      state.statusCode = code
      return this
    },
    json(payload: unknown) {
      state.body = payload
      return this
    },
    send(payload: unknown) {
      state.sent = payload
      return this
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value
    },
  }
}

function createRequest(overrides: Partial<any> = {}): any {
  const { headers: overrideHeaders, ...restOverrides } = overrides

  return {
    method: 'POST',
    headers: {
      host: 'mushi.example.com',
      origin: 'https://mushi.example.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.11',
      ...(overrideHeaders || {}),
    },
    body: {
      id: 'HI-100',
      title: 'Sample bug',
      description: 'A bug description',
      severity: 'high',
      tester: 'QA User',
      page: 'Home',
      device: 'Desktop',
      category: 'UI',
      attachments: [{ name: 'shot.png', url: 'https://cdn.example.com/shot.png', type: 'image/png' }],
      request_devin: false,
    },
    ...restOverrides,
  }
}

const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.BACKLOG_WEBHOOK_URL = 'https://n8n.dev.ax.accessacloud.com/webhook/bug-to-backlog'
  process.env.BACKLOG_ALLOWED_HOSTS = 'n8n.dev.ax.accessacloud.com'
  process.env.BACKLOG_WEBHOOK_SECRET = ''
  process.env.BACKLOG_WEBHOOK_SECRET_HEADER = ''
  process.env.PUBLISH_RATE_LIMIT_MAX = '20'
  process.env.PUBLISH_RATE_LIMIT_WINDOW_SECONDS = '60'
  process.env.NODE_ENV = 'production'

  globalThis.fetch = mock(async () => {
    return new Response(JSON.stringify({ success: true, url: 'https://dev.azure.com/workitem/1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
})

afterEach(() => {
  process.env = { ...originalEnv }
  globalThis.fetch = originalFetch
})

describe('api/backlog/publish', () => {
  test('rejects non-POST methods', async () => {
    const req = createRequest({ method: 'GET' })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('rejects forbidden origins', async () => {
    const req = createRequest({
      headers: {
        host: 'mushi.example.com',
        origin: 'https://evil.example.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-for': '203.0.113.12',
      },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ success: false, error: 'Forbidden origin' })
  })

  test('forwards valid payload to configured webhook', async () => {
    process.env.BACKLOG_WEBHOOK_SECRET = 'shared-secret'
    process.env.BACKLOG_WEBHOOK_SECRET_HEADER = 'x-test-secret'

    const req = createRequest({
      headers: {
        host: 'mushi.example.com',
        origin: 'https://mushi.example.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-for': '203.0.113.13',
      },
    })
    const res = createMockResponse()

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>

    await handler(req, res)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://n8n.dev.ax.accessacloud.com/webhook/bug-to-backlog')
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>)['x-test-secret']).toBe('shared-secret')
    expect(res.statusCode).toBe(200)
    expect(res.sent).toContain('success')
  })

  test('rejects webhook target host outside allowlist', async () => {
    process.env.BACKLOG_WEBHOOK_URL = 'https://example.com/webhook'
    process.env.BACKLOG_ALLOWED_HOSTS = 'n8n.dev.ax.accessacloud.com'

    const req = createRequest({
      headers: {
        host: 'mushi.example.com',
        origin: 'https://mushi.example.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-for': '203.0.113.40',
      },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'BACKLOG_WEBHOOK_URL host is not in BACKLOG_ALLOWED_HOSTS.' })
  })

  test('rate limits repeated publish attempts from same IP', async () => {
    process.env.PUBLISH_RATE_LIMIT_MAX = '1'
    process.env.PUBLISH_RATE_LIMIT_WINDOW_SECONDS = '60'

    const headers = {
      host: 'mushi.example.com',
      origin: 'https://mushi.example.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.99',
    }

    const firstReq = createRequest({ headers })
    const firstRes = createMockResponse()
    await handler(firstReq, firstRes)
    expect(firstRes.statusCode).toBe(200)

    const secondReq = createRequest({ headers })
    const secondRes = createMockResponse()
    await handler(secondReq, secondRes)

    expect(secondRes.statusCode).toBe(429)
    expect(secondRes.body).toEqual({ success: false, error: 'Too many publish attempts. Please try again shortly.' })
    expect(secondRes.headers['retry-after']).toBeDefined()
  })
})
