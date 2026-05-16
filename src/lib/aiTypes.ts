import type { Severity } from '../constants'
import type { Attachment } from '../types'

export interface ParsedBug {
  title: string
  description: string
  severity: Severity
  tester: string
  device: string
  page: string
  category: string
}

export interface BugPreview extends ParsedBug {
  _key: string
  _created?: boolean
  _createdId?: string
  _creating?: boolean
  _attachments?: Attachment[]
}

export type SessionActionType =
  | 'create_session'
  | 'copy_scenarios'
  | 'remove_tester'
  | 'reactivate_tester'
  | 'add_tester'
  | 'delete_tester'
  | 'assign_tester'
  | 'delete_session'
  | 'delete_scenarios'
  // Bug actions
  | 'edit_bug'
  | 'resolve_bug'
  | 'reopen_bug'
  | 'delete_bug'
  | 'add_comment'
  // Scenario actions
  | 'add_scenario'
  | 'edit_scenario'
  // Session status
  | 'set_session_status'
  // Tester editing
  | 'edit_tester'

export interface SessionAction {
  action: SessionActionType
  // Session fields
  name?: string
  date?: string
  from_session?: string
  // Tester fields
  tester?: string
  devices?: string[]
  // Scenario fields
  scenario?: string
  scenarios?: string[]
  letter?: string
  title?: string
  description?: string
  device_requirement?: string
  // Bug fields
  bug?: string
  severity?: string
  device?: string
  page?: string
  category?: string
  comment?: string
  // Session status
  status?: string
}

export interface SessionActionResult {
  action: SessionActionType
  success: boolean
  sessionId?: string
  sessionName?: string
  message: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  bugs?: BugPreview[]
  sessionActions?: SessionActionResult[]
}
