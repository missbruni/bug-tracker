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

export const ACTIVE_TEAM_SESSION_KEY = 'mushi-active-team'

export function scopeToTeam<T>(query: T, activeTeamId: string | null, column = 'team_id'): T {
  if (!activeTeamId) {
    if (import.meta.env.DEV) {
      console.warn('[scopeToTeam] No activeTeamId — query will not be team-scoped. RLS still enforces access.')
    }
    return query
  }
  const chain = query as unknown as { eq?: (name: string, value: string) => T }
  if (typeof chain.eq !== 'function') return query
  return chain.eq(column, activeTeamId)
}

export function withTeamPayload<T extends Record<string, unknown>>(payload: T, activeTeamId: string | null): T {
  if (!activeTeamId) {
    if (import.meta.env.DEV) {
      console.warn('[withTeamPayload] No activeTeamId — payload will not include team_id.')
    }
    return payload
  }
  return { ...payload, team_id: activeTeamId }
}

export function buildAttachmentPath(teamId: string | null, bugId: string, fileName: string): string {
  if (!teamId) {
    if (import.meta.env.DEV) {
      console.warn('[buildAttachmentPath] No teamId — using legacy unscoped path.')
    }
    return `${bugId}/${Date.now()}-${fileName}`
  }
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
