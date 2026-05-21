import { SEVERITIES } from '../constants'
import { supabase } from '../supabaseClient'
import { scopeToTeam } from './teamScope'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Severity } from '../constants'
import type { ParsedBug, SessionAction } from './aiTypes'

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

export async function generateBugId(severity: Severity, activeTeamId: string | null = null): Promise<string> {
  const prefix = severity === 'critical' ? 'CRT' : severity === 'high' ? 'HI' : 'LO'
  if (!supabase) return `${prefix}-01`

  const { data } = await scopeToTeam(
    supabase
      .from('bugs')
      .select('id')
      .like('id', `${prefix}-%`),
    activeTeamId,
  )

  let maxNum = 0
  ;(data || []).forEach((row: { id: string }) => {
    const num = parseInt(row.id.replace(/\D+/g, '')) || 0
    if (num > maxNum) maxNum = num
  })
  return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`
}

export function incrementBugId(currentId: string): string {
  const match = currentId.match(/^([A-Z]+-?)(\d+)$/)
  if (!match) return `${currentId}-1`
  const [, prefix, digits] = match
  const next = Number(digits) + 1
  return `${prefix}${String(next).padStart(digits.length, '0')}`
}

const MAX_ID_RETRIES = 50

export async function insertBugWithRetry(
  sb: SupabaseClient,
  bugData: Record<string, unknown>,
  startId: string,
): Promise<string> {
  let finalId = startId
  for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
    bugData.id = finalId
    const { error } = await sb.from('bugs').insert(bugData)
    if (!error) return finalId
    if (error.code === '23505') {
      finalId = incrementBugId(finalId)
    } else {
      throw new Error(error.message)
    }
  }
  throw new Error('Failed to create bug after multiple ID retries')
}
