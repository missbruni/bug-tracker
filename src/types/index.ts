import type { Severity } from '../constants'

// ─── Mushi ───────────────────────────────────────────────

export interface Attachment {
  id?: number
  bug_id?: string
  team_id?: string
  name: string
  url: string
  type: string
  file?: File
  note?: string
}

export interface Comment {
  id?: number
  bug_id?: string
  team_id?: string
  text: string
  time?: string
}

export interface Bug {
  id: string
  team_id?: string
  title: string
  description: string
  severity: Severity
  tester: string
  tester_id?: string | null
  device: string
  page: string
  category: string | null
  created_at?: string
  reviewed?: boolean
  backlog_url?: string | null
  devin_url?: string | null
  session_id?: string | null
  comments: Comment[]
  attachments: Attachment[]
}

export interface Question {
  id: string
  team_id?: string
  text: string
  tester: string
  created_at?: string
}

// ─── Teams ─────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  created_at?: string
}

export interface Team {
  id: string
  organization_id: string
  name: string
  slug: string
  created_by?: string | null
  created_at?: string
}

export type TeamRole = 'team_admin' | 'member'

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  status: 'active' | 'invited' | 'disabled'
  created_at?: string
}

export interface TeamInvitation {
  id: string
  team_id: string
  email: string
  role: TeamRole
  invited_by: string
  status: 'pending' | 'accepted' | 'expired'
  created_at?: string
}

export interface LightboxState {
  src: string
  alt: string
  type: string
}

// ─── Sessions ──────────────────────────────────────────────────

export type SessionStatus = 'draft' | 'active' | 'completed'

export interface Session {
  id: string
  team_id?: string
  product_id?: string | null
  name: string
  date: string | null
  status: SessionStatus
  duration_seconds?: number | null
  created_at: string
}

export interface SessionWithStats extends Session {
  scenario_count?: number
  assignment_count?: number
  feedback_avg?: number
  feedback_count?: number
}

export interface SessionOption {
  id: string
  name: string
  status: string
}

export interface Scenario {
  id: string
  team_id?: string
  session_id: string
  letter: string
  title: string
  description: string | null
  device_requirement: string | null
  sort_order: number
}

export interface Assignment {
  id: string
  team_id?: string
  session_id: string
  scenario_id: string
  tester_id: string
}

// ─── Testers ───────────────────────────────────────────────────

export interface Tester {
  id: string
  team_id?: string
  name: string
  devices: string[]
  active?: boolean
}

// ─── Feedback ──────────────────────────────────────────────────

export type LengthFeel = 'too_short' | 'just_right' | 'too_long'
export type Helpfulness = 'not_at_all' | 'somewhat' | 'very'

export interface Feedback {
  id: string
  team_id?: string
  session_id: string
  name: string | null
  rating: number
  length_feel: LengthFeel
  clarity: number
  helpfulness: Helpfulness
  worked_well: string | null
  to_improve: string | null
  created_at: string
}
