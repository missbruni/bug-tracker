import { supabase } from '../supabaseClient'
import type { SessionAction, SessionActionResult } from './aiTypes'

interface ActionContext {
  sessionId: string | null
  onSessionCreated: (id: string) => void
}

export async function executeSessionActionWithSession(
  action: SessionAction,
  ctx: ActionContext,
): Promise<SessionActionResult> {
  if (!supabase) return { action: action.action, success: false, message: 'Database not connected' }

  const { sessionId } = ctx

  switch (action.action) {
    case 'create_session': {
      const name = action.name?.trim()
      if (!name) return { action: 'create_session', success: false, message: 'Session name is required' }
      const { data, error: err } = await supabase
        .from('sessions')
        .insert({ name, date: action.date || null, status: 'draft' })
        .select()
      if (err || !data?.[0]) return { action: 'create_session', success: false, message: err?.message || 'Failed to create session' }
      const session = data[0]
      ctx.onSessionCreated(session.id)
      return { action: 'create_session', success: true, sessionId: session.id, sessionName: name, message: `Session "${name}" created!` }
    }

    case 'copy_scenarios': {
      const fromName = action.from_session?.trim()
      if (!fromName || !sessionId) return { action: 'copy_scenarios', success: false, message: !sessionId ? 'Create a session first' : 'Source session name required' }
      // Find source session by name
      const { data: srcSessions } = await supabase
        .from('sessions')
        .select('id')
        .ilike('name', fromName)
        .limit(1)
      if (!srcSessions?.length) return { action: 'copy_scenarios', success: false, message: `Session "${fromName}" not found` }
      const srcId = srcSessions[0].id
      // Fetch scenarios
      const { data: scenarios } = await supabase
        .from('scenarios')
        .select('letter, title, description, device_requirement, sort_order')
        .eq('session_id', srcId)
        .order('sort_order')
      if (!scenarios?.length) return { action: 'copy_scenarios', success: false, message: `No scenarios found in "${fromName}"` }
      // Insert copies
      const copies = scenarios.map((s: { letter: string; title: string; description: string | null; device_requirement: string | null; sort_order: number }) => ({
        session_id: sessionId,
        letter: s.letter,
        title: s.title,
        description: s.description,
        device_requirement: s.device_requirement,
        sort_order: s.sort_order,
      }))
      const { error: insErr } = await supabase.from('scenarios').insert(copies)
      if (insErr) return { action: 'copy_scenarios', success: false, message: insErr.message }
      return { action: 'copy_scenarios', success: true, sessionId: sessionId, message: `Copied ${scenarios.length} scenarios from "${fromName}"` }
    }

    case 'remove_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'remove_tester', success: false, message: 'Tester name required' }
      // Find the tester
      const { data: matchedTesters } = await supabase.from('testers').select('id, name').ilike('name', name).limit(1)
      if (!matchedTesters?.length) return { action: 'remove_tester', success: false, message: `Tester "${name}" not found` }
      // Deactivate in DB (same as toggling off on Testers page)
      const { error: deactivateErr } = await supabase.from('testers').update({ active: false }).eq('id', matchedTesters[0].id)
      if (deactivateErr) return { action: 'remove_tester', success: false, message: deactivateErr.message }
      return { action: 'remove_tester', success: true, sessionId: sessionId || undefined, message: `Deactivated ${matchedTesters[0].name} — they won't appear in any session pool` }
    }

    case 'add_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'add_tester', success: false, message: 'Tester name required' }
      // Check if they already exist
      const { data: existing } = await supabase.from('testers').select('id, name, active').ilike('name', name).limit(1)
      if (existing?.length) {
        if (!existing[0].active) {
          // Reactivate instead
          await supabase.from('testers').update({ active: true }).eq('id', existing[0].id)
          return { action: 'add_tester', success: true, sessionId: sessionId || undefined, message: `${existing[0].name} was inactive — reactivated them` }
        }
        return { action: 'add_tester', success: true, sessionId: sessionId || undefined, message: `${existing[0].name} already exists and is active` }
      }
      // Create new tester
      const { data: newTester, error: createErr } = await supabase.from('testers').insert({ name, devices: [] }).select().single()
      if (createErr || !newTester) return { action: 'add_tester', success: false, message: createErr?.message || 'Failed to create tester' }
      return { action: 'add_tester', success: true, sessionId: sessionId || undefined, message: `Created new tester "${newTester.name}" — they'll appear in session pools (no devices configured yet)` }
    }

    case 'reactivate_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'reactivate_tester', success: false, message: 'Tester name required' }
      const { data: matchedTesters } = await supabase.from('testers').select('id, name, active').ilike('name', name).limit(1)
      if (!matchedTesters?.length) return { action: 'reactivate_tester', success: false, message: `Tester "${name}" not found` }
      if (matchedTesters[0].active) return { action: 'reactivate_tester', success: true, sessionId: sessionId || undefined, message: `${matchedTesters[0].name} is already active` }
      const { error: activateErr } = await supabase.from('testers').update({ active: true }).eq('id', matchedTesters[0].id)
      if (activateErr) return { action: 'reactivate_tester', success: false, message: activateErr.message }
      return { action: 'reactivate_tester', success: true, sessionId: sessionId || undefined, message: `Reactivated ${matchedTesters[0].name} — they'll appear in session pools again` }
    }

    case 'delete_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'delete_tester', success: false, message: 'Tester name required' }
      const { data: matchedTesters } = await supabase.from('testers').select('id, name').ilike('name', name).limit(1)
      if (!matchedTesters?.length) return { action: 'delete_tester', success: false, message: `Tester "${name}" not found` }
      // Check for assignment dependencies
      const { count: assignmentCount, error: assignmentErr } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tester_id', matchedTesters[0].id)
      if (assignmentErr) {
        return { action: 'delete_tester', success: false, message: `Failed to verify assignments: ${assignmentErr.message}` }
      }

      // Check for bug dependencies via tester_id (preferred)
      let bugCount = 0
      const bugByIdRes = await supabase
        .from('bugs')
        .select('*', { count: 'exact', head: true })
        .eq('tester_id', matchedTesters[0].id)
      if (bugByIdRes.error) {
        // Backward compatibility for databases that haven't added bugs.tester_id yet
        if (!bugByIdRes.error.message.toLowerCase().includes('tester_id')) {
          return { action: 'delete_tester', success: false, message: `Failed to verify bug dependencies: ${bugByIdRes.error.message}` }
        }
        const legacyBugRes = await supabase
          .from('bugs')
          .select('*', { count: 'exact', head: true })
          .ilike('tester', matchedTesters[0].name)
        if (legacyBugRes.error) {
          return { action: 'delete_tester', success: false, message: `Failed to verify bug dependencies: ${legacyBugRes.error.message}` }
        }
        bugCount = legacyBugRes.count || 0
      } else {
        bugCount = bugByIdRes.count || 0
      }

      if ((assignmentCount || 0) > 0 || bugCount > 0) {
        const reasons: string[] = []
        if ((assignmentCount || 0) > 0) reasons.push(`${assignmentCount} assignment(s)`)
        if (bugCount > 0) reasons.push(`${bugCount} bug(s)`)
        return {
          action: 'delete_tester',
          success: false,
          message: `Can't delete ${matchedTesters[0].name} — linked to ${reasons.join(' and ')}. Deactivate them instead.`,
        }
      }

      const { error: delErr } = await supabase.from('testers').delete().eq('id', matchedTesters[0].id)
      if (delErr) return { action: 'delete_tester', success: false, message: delErr.message }
      return { action: 'delete_tester', success: true, sessionId: sessionId || undefined, message: `Permanently deleted tester "${matchedTesters[0].name}"` }
    }

    case 'assign_tester': {
      const testerName = action.tester?.trim()
      const scenarioLetter = action.scenario?.trim().toUpperCase()
      if (!testerName || !scenarioLetter || !sessionId) {
        return { action: 'assign_tester', success: false, message: !sessionId ? 'Create a session first' : 'Need tester name and scenario letter' }
      }
      // Find tester
      const { data: testers } = await supabase.from('testers').select('id, name').ilike('name', testerName).limit(1)
      if (!testers?.length) return { action: 'assign_tester', success: false, message: `Tester "${testerName}" not found` }
      // Find scenario
      const { data: scenarios } = await supabase.from('scenarios').select('id, letter').eq('session_id', sessionId).ilike('letter', scenarioLetter).limit(1)
      if (!scenarios?.length) return { action: 'assign_tester', success: false, message: `Scenario "${scenarioLetter}" not found in this session` }
      // Upsert assignment
      const existingAssign = await supabase.from('assignments').select('id').eq('session_id', sessionId).eq('scenario_id', scenarios[0].id).limit(1)
      if (existingAssign.data?.length) {
        await supabase.from('assignments').delete().eq('id', existingAssign.data[0].id)
      }
      const { error: insErr } = await supabase.from('assignments').insert({
        session_id: sessionId,
        scenario_id: scenarios[0].id,
        tester_id: testers[0].id,
      })
      if (insErr) return { action: 'assign_tester', success: false, message: insErr.message }
      return { action: 'assign_tester', success: true, sessionId: sessionId, message: `Assigned ${testers[0].name} to scenario ${scenarios[0].letter}` }
    }

    case 'delete_scenarios': {
      const letters = action.scenarios?.map(l => l.trim().toUpperCase()).filter(Boolean)
      if (!letters?.length || !sessionId) return { action: 'delete_scenarios', success: false, message: !sessionId ? 'No session in context' : 'Scenario letters required' }
      const deleted: string[] = []
      const notFound: string[] = []
      for (const letter of letters) {
        const { data: scenarios } = await supabase.from('scenarios').select('id, letter').eq('session_id', sessionId).ilike('letter', letter).limit(1)
        if (scenarios?.length) {
          await supabase.from('assignments').delete().eq('scenario_id', scenarios[0].id)
          await supabase.from('scenarios').delete().eq('id', scenarios[0].id)
          deleted.push(scenarios[0].letter)
        } else {
          notFound.push(letter)
        }
      }
      const parts: string[] = []
      if (deleted.length) parts.push(`Deleted scenario${deleted.length > 1 ? 's' : ''} ${deleted.join(', ')}`)
      if (notFound.length) parts.push(`${notFound.join(', ')} not found`)
      return { action: 'delete_scenarios', success: deleted.length > 0, sessionId, message: parts.join('. ') }
    }

    case 'delete_session': {
      const sessionName = action.name?.trim()
      if (!sessionName) return { action: 'delete_session', success: false, message: 'Session name required' }
      const { data: sessions } = await supabase.from('sessions').select('id, name').ilike('name', sessionName).limit(1)
      if (!sessions?.length) return { action: 'delete_session', success: false, message: `Session "${sessionName}" not found` }
      const sid = sessions[0].id
      await supabase.from('assignments').delete().eq('session_id', sid)
      await supabase.from('scenarios').delete().eq('session_id', sid)
      await supabase.from('session_feedback').delete().eq('session_id', sid)
      const { error } = await supabase.from('sessions').delete().eq('id', sid)
      if (error) return { action: 'delete_session', success: false, message: error.message }
      // Notify about deletion
      if (sessionId === sid) {
        ctx.onSessionCreated(null as unknown as string) // clears current session
      }
      window.dispatchEvent(new CustomEvent('sessionDeleted', { detail: { sessionId: sid } }))
      return { action: 'delete_session', success: true, message: `Deleted session "${sessions[0].name}" and all its data` }
    }

    default:
      return { action: action.action, success: false, message: 'Unknown action' }
  }
}
