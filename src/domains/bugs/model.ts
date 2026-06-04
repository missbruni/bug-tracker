import type { Severity } from '../../constants'

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
  mentioned_user_ids?: string[]
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
  azure_url?: string | null
  backlog_item_id?: string | null
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
