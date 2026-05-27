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
  | 'create_bug'
  | 'edit_bug'
  | 'resolve_bug'
  | 'reopen_bug'
  | 'delete_bug'
  | 'add_comment'
  // Bulk bug actions
  | 'bulk_resolve'
  | 'bulk_delete'
  // Export
  | 'export_bugs'
  // Scenario actions
  | 'add_scenario'
  | 'edit_scenario'
  // Session status
  | 'set_session_status'
  // Tester editing
  | 'edit_tester'
  // Bug filters (UI only)
  | 'set_bug_filters'
  // Team & product management
  | 'create_team'
  | 'create_product'
  | 'edit_product'

export interface BugFiltersActionPayload {
  severity?: string | string[]
  severities?: string[]
  tester?: string
  date?: string
  session?: string
  sort?: string
  search?: string
  clear?: boolean
}

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
  // Bulk fields
  bugs?: string[]
  filter?: string
  // Export fields
  format?: 'csv' | 'json'
  // Bug filters fields
  session?: string
  severities?: string[]
  sort?: string
  search?: string
  clear?: boolean
  // Session status
  status?: string
  // Team & product fields
  team?: string
  link?: string
}

export interface SessionActionResult {
  action: SessionActionType
  success: boolean
  level?: 'success' | 'warning' | 'error'
  sessionId?: string
  sessionName?: string
  message: string
  exportFormat?: 'csv' | 'json'
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  bugs?: BugPreview[]
  sessionActions?: SessionActionResult[]
}
