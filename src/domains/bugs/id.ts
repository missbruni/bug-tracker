import type { SupabaseClient } from '@supabase/supabase-js'
import type { Severity } from '../../constants'
import { supabase } from '../../supabaseClient'
import { scopeToTeam } from '../../lib/teamScope'

const MAX_ID_RETRIES = 50

function getSeverityPrefix(severity: Severity): string {
  if (severity === 'critical') return 'CRT'
  if (severity === 'high') return 'HI'
  return 'LO'
}

export async function generateBugId(severity: Severity, activeTeamId: string | null = null): Promise<string> {
  const prefix = getSeverityPrefix(severity)
  if (!supabase) return `${prefix}-01`

  const { data } = await scopeToTeam(
    supabase
      .from('bugs')
      .select('id')
      .like('id', `${prefix}-%`),
    activeTeamId,
  )

  let highestNumericId = 0
  ;(data || []).forEach((row: { id: string }) => {
    const numericId = parseInt(row.id.replace(/\D+/g, ''), 10) || 0
    if (numericId > highestNumericId) highestNumericId = numericId
  })

  return `${prefix}-${String(highestNumericId + 1).padStart(2, '0')}`
}

export function incrementBugId(currentId: string): string {
  const match = currentId.match(/^([A-Z]+-?)(\d+)$/)
  if (!match) return `${currentId}-1`

  const [, prefix, digits] = match
  const nextNumber = Number(digits) + 1
  return `${prefix}${String(nextNumber).padStart(digits.length, '0')}`
}

export async function insertBugWithRetry(
  supabaseClient: SupabaseClient,
  bugData: Record<string, unknown>,
  startId: string,
): Promise<string> {
  let finalId = startId

  for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
    bugData.id = finalId
    const { error } = await supabaseClient.from('bugs').insert(bugData)

    if (!error) return finalId
    if (error.code === '23505') {
      finalId = incrementBugId(finalId)
      continue
    }

    throw new Error(error.message)
  }

  throw new Error('Failed to create bug after multiple ID retries')
}
