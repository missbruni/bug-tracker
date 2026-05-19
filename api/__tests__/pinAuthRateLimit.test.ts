import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import handler from '../auth/pin'

interface MockResponse {
  statusCode: number
  body: unknown
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
    headers: {} as Record<string, string>,
  }

  return {
    get statusCode() {
      return state.statusCode
    },
    get body() {
      return state.body
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
      state.body = payload
      return this
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value
    },
  }
}

function createRequest(pin: string, ip: string): any {
  return {
    method: 'POST',
    body: { pin },
    headers: {
      'x-forwarded-for': ip,
      'x-forwarded-proto': 'https',
    },
  }
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.TEAM_PIN = '1111'
  process.env.GOD_PIN = '9999'
  process.env.PIN_SESSION_SECRET = 'super-secret-value'
  process.env.PIN_RATE_LIMIT_MAX = '100'
  process.env.PIN_RATE_LIMIT_WINDOW_SECONDS = '60'
  process.env.PIN_FAILED_ATTEMPTS_MAX = '5'
  process.env.PIN_FAILED_ATTEMPTS_WINDOW_SECONDS = '300'
  process.env.PIN_FAILED_COOLDOWN_SECONDS = '600'
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('api/auth/pin rate controls', () => {
  test('allows valid PIN and returns signed session cookie', async () => {
    const req = createRequest('1111', '198.51.100.10')
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ role: 'team' })
    expect(res.headers['set-cookie']).toContain('mushi_pin_session=')
  })

  test('returns 401 for wrong PIN before threshold', async () => {
    const req = createRequest('0000', '198.51.100.11')
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Wrong PIN. Try again.' })
  })

  test('triggers failure cooldown after repeated wrong PIN attempts', async () => {
    process.env.PIN_FAILED_ATTEMPTS_MAX = '2'
    process.env.PIN_FAILED_COOLDOWN_SECONDS = '120'

    const ip = '198.51.100.12'

    const first = createMockResponse()
    await handler(createRequest('0000', ip), first)
    expect(first.statusCode).toBe(401)

    const second = createMockResponse()
    await handler(createRequest('0000', ip), second)
    expect(second.statusCode).toBe(429)
    expect(second.body).toEqual({ error: 'Too many failed PIN attempts. Please wait before trying again.' })
    expect(second.headers['retry-after']).toBeDefined()

    const blocked = createMockResponse()
    await handler(createRequest('1111', ip), blocked)
    expect(blocked.statusCode).toBe(429)
    expect(blocked.body).toEqual({ error: 'Too many failed PIN attempts. Please wait before trying again.' })
  })

  test('triggers global PIN request throttle on rapid attempts', async () => {
    process.env.PIN_RATE_LIMIT_MAX = '1'
    process.env.PIN_RATE_LIMIT_WINDOW_SECONDS = '60'

    const ip = '198.51.100.13'

    const first = createMockResponse()
    await handler(createRequest('0000', ip), first)
    expect(first.statusCode).toBe(401)

    const second = createMockResponse()
    await handler(createRequest('0000', ip), second)

    expect(second.statusCode).toBe(429)
    expect(second.body).toEqual({ error: 'Too many PIN attempts. Please try again shortly.' })
    expect(second.headers['retry-after']).toBeDefined()
  })
})
