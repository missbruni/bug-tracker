import { SEVERITIES } from '../constants'
import type { Severity } from '../constants'
import type { Attachment } from '../domains/bugs/model'
import type { SessionAction } from './aiSessionActions'

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

export function parseBugsFromResponse(text: string): ParsedBug[] {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (!jsonMatch) return []
  try {
    const parsed = JSON.parse(jsonMatch[1])
    if (!Array.isArray(parsed)) return []
    return parsed.map((b: Record<string, unknown>) => ({
      title: String(b.title || ''),
      description: String(b.description || ''),
      severity: SEVERITIES.includes(b.severity as Severity) ? (b.severity as Severity) : 'high',
      tester: String(b.tester || 'Unknown'),
      device: String(b.device || '\u2014'),
      page: String(b.page || '\u2014'),
      category: String(b.category || ''),
    }))
  } catch {
    return []
  }
}

export function stripJsonBlock(text: string): string {
  return text
    .replace(/```json\s*[\s\S]*?```/g, '')
    .replace(/```session_action\s*[\s\S]*?```/g, '')
    .trim()
}

export function parseSessionActions(text: string): SessionAction[] {
  const actions: SessionAction[] = []
  const regex = /```session_action\s*([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed && parsed.action) actions.push(parsed as SessionAction)
    } catch { /* ignore parse errors */ }
  }
  return actions
}
