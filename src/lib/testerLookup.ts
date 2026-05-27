import { supabase } from '../supabaseClient'
import { scopeToTeam, withTeamPayload } from './teamScope'

export interface Tester {
  id: string
  team_id?: string
  name: string
  devices: string[]
  active?: boolean
}

export async function findTesterByName(name: string, activeTeamId: string | null = null): Promise<{ id: string; name: string } | null> {
  if (!supabase) return null
  const normalized = name.trim()
  if (!normalized || normalized === 'Unknown') return null

  const { data, error } = await scopeToTeam(
    supabase
      .from('testers')
      .select('id, name')
      .ilike('name', normalized)
      .limit(1),
    activeTeamId,
  )

  if (error || !data?.length) return null
  return { id: data[0].id as string, name: data[0].name as string }
}

export async function ensureTesterByName(name: string, devices: string[] = [], activeTeamId: string | null = null): Promise<{ id: string; name: string } | null> {
  if (!supabase) return null
  const normalized = name.trim()
  if (!normalized || normalized === 'Unknown') return null

  const { data: existing, error: existingErr } = await scopeToTeam(
    supabase
      .from('testers')
      .select('id, name, active')
      .ilike('name', normalized)
      .limit(1),
    activeTeamId,
  )

  if (existingErr) return null

  if (existing?.length) {
    const row = existing[0] as { id: string; name: string; active: boolean }
    if (!row.active) {
      const updatePayload: { active: boolean; devices?: string[] } = { active: true }
      if (devices.length) updatePayload.devices = devices
      let reactivateQuery = supabase
        .from('testers')
        .update(updatePayload)
        .eq('id', row.id)
      reactivateQuery = scopeToTeam(reactivateQuery, activeTeamId)
      const { error: reactivateErr } = await reactivateQuery
      if (reactivateErr) return null
    }
    return { id: row.id, name: row.name }
  }

  const { data: created, error: createErr } = await supabase
    .from('testers')
    .insert(withTeamPayload({ name: normalized, devices, active: true }, activeTeamId))
    .select('id, name')
    .single()

  if (createErr || !created) return null
  return { id: created.id as string, name: created.name as string }
}
