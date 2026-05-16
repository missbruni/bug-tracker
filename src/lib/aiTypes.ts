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

export interface SessionAction {
  action: 'create_session' | 'copy_scenarios' | 'remove_tester' | 'reactivate_tester' | 'add_tester' | 'delete_tester' | 'assign_tester' | 'delete_session' | 'delete_scenarios'
  name?: string
  date?: string
  from_session?: string
  tester?: string
  scenario?: string
  scenarios?: string[]
}

export interface SessionActionResult {
  action: SessionAction['action']
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
