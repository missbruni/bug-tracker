export interface TeamStats {
  testers: number
  activeTesters: number
  sessions: number
  activeBugs: number
  members: number
}

export interface ProductLink {
  label: string
  url: string
}

export interface Product {
  id: string
  team_id: string
  name: string
  slug: string
  description?: string | null
  link?: string | null
  links?: ProductLink[] | null
}

export interface ProductInput {
  name: string
  description?: string
  links?: ProductLink[]
}

export interface TeamSettingsUpdate {
  timezone: string | null
  default_product_id: string | null
  backlog_key: string
  default_backlog_provider: 'mushi' | 'azure'
}

export type TeamRole = 'team_admin' | 'member'

export interface TeamMemberRow {
  id: string
  user_id: string
  email: string
  display_name: string
  avatar_url?: string | null
  role: TeamRole
}

export interface TeamInvitationRow {
  id: string
  email: string
  role: TeamRole
  created_at: string
}

export interface OrgUser {
  id: string
  email: string
  display_name: string
  avatar_url?: string | null
}
