function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export function toSingleHeader(value: string | string[] | undefined): string {
  return firstHeaderValue(value)
}

export function getRequestOrigin(req: any): string {
  const host = toSingleHeader(req?.headers?.host)
  if (!host) return ''

  const forwardedProto = toSingleHeader(req?.headers?.['x-forwarded-proto'])
  const protocol = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${protocol}://${host}`
}

export function isSameOriginBrowserRequest(req: any): boolean {
  const origin = toSingleHeader(req?.headers?.origin)
  if (!origin) return process.env.NODE_ENV !== 'production'

  const requestOrigin = getRequestOrigin(req)
  if (!requestOrigin) return false

  try {
    return new URL(origin).origin === new URL(requestOrigin).origin
  } catch {
    return false
  }
}

export function getClientIp(req: any): string {
  const forwardedFor = toSingleHeader(req?.headers?.['x-forwarded-for'])
  const firstForwarded = forwardedFor
    .split(',')
    .map((part) => part.trim())
    .find(Boolean)

  if (firstForwarded) return firstForwarded

  const realIp = toSingleHeader(req?.headers?.['x-real-ip']).trim()
  if (realIp) return realIp

  const socketIp = (req?.socket?.remoteAddress as string | undefined) ?? ''
  if (socketIp) return socketIp

  return 'unknown'
}
