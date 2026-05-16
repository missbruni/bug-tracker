import { supabase } from '../supabaseClient'

export async function findTesterByName(name: string): Promise<{ id: string; name: string } | null> {
  if (!supabase) return null
  const normalized = name.trim()
  if (!normalized || normalized === 'Unknown') return null

  const { data, error } = await supabase
    .from('testers')
    .select('id, name')
    .ilike('name', normalized)
    .limit(1)

  if (error || !data?.length) return null
  return { id: data[0].id as string, name: data[0].name as string }
}

export async function ensureTesterByName(name: string, devices: string[] = []): Promise<{ id: string; name: string } | null> {
  if (!supabase) return null
  const normalized = name.trim()
  if (!normalized || normalized === 'Unknown') return null

  const { data: existing, error: existingErr } = await supabase
    .from('testers')
    .select('id, name, active')
    .ilike('name', normalized)
    .limit(1)

  if (existingErr) return null

  if (existing?.length) {
    const row = existing[0] as { id: string; name: string; active: boolean }
    if (!row.active) {
      const updatePayload: { active: boolean; devices?: string[] } = { active: true }
      if (devices.length) updatePayload.devices = devices
      const { error: reactivateErr } = await supabase
        .from('testers')
        .update(updatePayload)
        .eq('id', row.id)
      if (reactivateErr) return null
    }
    return { id: row.id, name: row.name }
  }

  const { data: created, error: createErr } = await supabase
    .from('testers')
    .insert({ name: normalized, devices, active: true })
    .select('id, name')
    .single()

  if (createErr || !created) return null
  return { id: created.id as string, name: created.name as string }
}
