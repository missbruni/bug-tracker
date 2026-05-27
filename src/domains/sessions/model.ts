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

export interface SessionOption {
  id: string
  name: string
  status: string
}
