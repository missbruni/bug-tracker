export type PinAccessLevel = 'team' | 'god'

export interface TeamRecord {
  id: string
  organization_id: string
  name: string
  slug: string
  created_at?: string
}

export const ORGANIZATION_ID = 'theaccessgroup'
export const DEFAULT_TEAM_SLUG = 'evo-ibe'
export const DEFAULT_TEAM_NAME = 'EVO IBE'
export const DEFAULT_TEAM_ID = '11111111-1111-1111-1111-111111111111'

export const PIN_SESSION_KEY = 'mushi-auth'
export const PIN_ROLE_SESSION_KEY = 'mushi-auth-role'
export const ACTIVE_TEAM_SESSION_KEY = 'mushi-active-team'

export function isPinAccessLevel(value: string | null): value is PinAccessLevel {
  return value === 'team' || value === 'god'
}

export function getPinRoleFromSessionStorage(): PinAccessLevel | null {
  if (typeof window === 'undefined') return null
  const role = sessionStorage.getItem(PIN_ROLE_SESSION_KEY)
  return isPinAccessLevel(role) ? role : null
}

export function scopeToTeam<T>(query: T, activeTeamId: string | null, column = 'team_id'): T {
  if (!activeTeamId) return query
  const chain = query as unknown as { eq?: (name: string, value: string) => T }
  if (typeof chain.eq !== 'function') return query
  return chain.eq(column, activeTeamId)
}

export function withTeamPayload<T extends Record<string, unknown>>(payload: T, activeTeamId: string | null): T {
  if (!activeTeamId) return payload
  return { ...payload, team_id: activeTeamId }
}

export function buildAttachmentPath(teamId: string | null, bugId: string, fileName: string): string {
  if (!teamId) return `${bugId}/${Date.now()}-${fileName}`
  return `teams/${teamId}/bugs/${bugId}/${Date.now()}-${fileName}`
}

export function parseAttachmentStoragePath(url?: string): string | null {
  if (!url) return null
  const path = url.split('/attachments/')[1]
  return path ? decodeURIComponent(path) : null
}

export function slugifyTeamName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'team'
}
