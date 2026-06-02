export type SessionActionType =
  | 'create_session'
  | 'clone_session'
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

import { supabase } from '../supabaseClient'
import { queryClient } from './queryClient'
import { scopeToTeam, withTeamPayload, slugifyTeamName, ORGANIZATION_ID } from './teamScope'
import { generateBugId, insertBugWithRetry } from '../domains/bugs/id'
import { useNotificationStore } from '../stores/notificationStore'
import type { Severity } from '../constants'

export interface SessionAction {
  action: SessionActionType
  name?: string
  date?: string
  from_session?: string
  tester?: string
  devices?: string[]
  scenario?: string
  scenarios?: string[]
  letter?: string
  title?: string
  description?: string
  device_requirement?: string
  bug?: string
  severity?: string
  device?: string
  page?: string
  category?: string
  comment?: string
  bugs?: string[]
  filter?: string
  format?: 'csv' | 'json'
  session?: string
  severities?: string[]
  sort?: string
  search?: string
  clear?: boolean
  include_assignments?: boolean
  status?: string
  team?: string
  link?: string
  mentions?: string[]
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

interface ActionContext {
  sessionId: string | null
  onSessionCreated: (id: string) => void
  activeTeamId: string | null
  isGodMode: boolean
  currentUserName?: string
}

const SESSION_ACTIONS = new Set(['create_session', 'clone_session', 'copy_scenarios', 'delete_session', 'set_session_status', 'add_scenario', 'edit_scenario', 'assign_tester'])
const TESTER_ACTIONS = new Set(['add_tester', 'remove_tester', 'reactivate_tester', 'delete_tester', 'edit_tester'])
const BUG_ACTIONS = new Set(['create_bug', 'edit_bug', 'resolve_bug', 'reopen_bug', 'delete_bug', 'add_comment', 'bulk_resolve', 'bulk_delete'])
const EXPORT_ACTIONS = new Set(['export_bugs'])
const TEAM_ACTIONS = new Set(['create_team', 'create_product', 'edit_product'])

const SEVERITY_PREFIX: Record<Severity, string> = {
  critical: 'CRT',
  high: 'HI',
  low: 'LO',
}

const parseSeverity = (value?: string): Severity => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'critical' || normalized === 'high' || normalized === 'low') return normalized
  return 'high'
}

const syncSeverityPrefixInTitle = (title: string, currentSeverity: Severity, nextSeverity: Severity): string => {
  if (currentSeverity === nextSeverity) return title

  const currentPrefix = SEVERITY_PREFIX[currentSeverity]
  const nextPrefix = SEVERITY_PREFIX[nextSeverity]
  const match = title.match(/^(\s*)(\[?)(CRT|HI|LO)(\]?)(?=(?:\s*[-:]|\s|$))/)

  if (!match || match[3] !== currentPrefix) return title

  const [, leading, openBracket, , closeBracket] = match
  return title.replace(/^(\s*)(\[?)(CRT|HI|LO)(\]?)/, `${leading}${openBracket}${nextPrefix}${closeBracket}`)
}

// ─── Bug matching helper ─────────────────────────────────────
async function findBugByQuery(query: string, activeTeamId: string | null): Promise<{ id: string; title: string; severity: Severity } | null> {
  if (!supabase || !query.trim()) return null
  const q = query.trim()

  // Try exact ID match first (e.g. "HI-03", "CRT-01")
  if (/^[A-Z]{2,3}-\d+$/i.test(q)) {
    const { data } = await scopeToTeam(
      supabase.from('bugs').select('id, title, severity').ilike('id', q).limit(1),
      activeTeamId,
    )
    if (data?.length) return data[0]
  }

  // Try case-insensitive title contains
  const { data: titleMatch } = await scopeToTeam(
    supabase
      .from('bugs')
      .select('id, title, severity')
      .ilike('title', `%${q}%`)
      .limit(1),
    activeTeamId,
  )
  if (titleMatch?.length) return titleMatch[0]

  // Try exact ID match as fallback (user might pass lowercase)
  const { data: idFallback } = await scopeToTeam(
    supabase.from('bugs').select('id, title, severity').ilike('id', `%${q}%`).limit(1),
    activeTeamId,
  )
  if (idFallback?.length) return idFallback[0]

  return null
}

interface MentionableUser {
  id: string
  email: string
  display_name: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function includesMention(text: string, displayName: string): boolean {
  return new RegExp(`(^|\\s)@${escapeRegExp(displayName)}(?=\\s|$|[.,!?;:])`, 'i').test(text)
}

async function resolveMentionedUserIds(comment: string, explicitMentions: string[] | undefined, activeTeamId: string | null): Promise<string[]> {
  if (!supabase || !activeTeamId) return []

  const [membersRes, orgUsersRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', activeTeamId)
      .eq('status', 'active'),
    supabase.rpc('get_org_users'),
  ])

  if (membersRes.error || orgUsersRes.error) return []

  const memberIds = new Set(((membersRes.data || []) as Array<{ user_id: string }>).map((member) => member.user_id))
  const mentionNames = new Set((explicitMentions || []).map((mention) => mention.trim().toLowerCase()).filter(Boolean))

  return ((orgUsersRes.data || []) as MentionableUser[])
    .filter((user) => memberIds.has(user.id))
    .filter((user) => {
      const displayName = user.display_name.toLowerCase()
      const email = user.email.toLowerCase()
      return mentionNames.has(displayName) || mentionNames.has(email) || includesMention(comment, user.display_name)
    })
    .map((user) => user.id)
}

async function notifyMentionedUsersFromAction(bugId: string, commentId: number, mentionedUserIds: string[]): Promise<void> {
  if (!supabase || mentionedUserIds.length === 0) return

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return

  try {
    const res = await fetch('/api/bug-comment-mention', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bugId, commentId, mentionedUserIds }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      console.warn('[mentions] email notification failed:', body.error || res.statusText)
    }
  } catch (mentionError) {
    console.warn('[mentions] email notification failed:', mentionError)
  }
}

export async function executeSessionActionWithSession(
  action: SessionAction,
  ctx: ActionContext,
): Promise<SessionActionResult> {
  if (!supabase) return { action: action.action, success: false, message: 'Database not connected' }

  const { sessionId, activeTeamId } = ctx

  if (TEAM_ACTIONS.has(action.action) && !ctx.isGodMode) {
    return {
      action: action.action,
      success: false,
      message: 'Only god mode can manage teams and products',
    }
  }

  switch (action.action) {
    case 'create_session': {
      const name = action.name?.trim()
      if (!name) return { action: 'create_session', success: false, message: 'Session name is required' }
      const { data, error: err } = await supabase
        .from('sessions')
        .insert(withTeamPayload({ name, date: action.date || null, status: 'draft' }, activeTeamId))
        .select()
      if (err || !data?.[0]) return { action: 'create_session', success: false, message: err?.message || 'Failed to create session' }
      const session = data[0]
      ctx.onSessionCreated(session.id)
      return { action: 'create_session', success: true, sessionId: session.id, sessionName: name, message: `Session "${name}" created!` }
    }

    case 'clone_session': {
      const sourceName = action.name?.trim()
      if (!sourceName) return { action: 'clone_session', success: false, message: 'Source session name is required' }

      // Find source session
      const { data: srcSessions } = await scopeToTeam(
        supabase.from('sessions').select('id, name, product_id').ilike('name', sourceName).limit(1),
        activeTeamId,
      )
      if (!srcSessions?.length) return { action: 'clone_session', success: false, message: `Session "${sourceName}" not found` }
      const src = srcSessions[0]

      // Create new session
      const cloneName = `Copy of ${src.name}`
      const { data: newSession, error: cloneErr } = await supabase
        .from('sessions')
        .insert(withTeamPayload({
          name: cloneName,
          date: action.date || null,
          status: 'draft',
          product_id: src.product_id || null,
        }, activeTeamId))
        .select()
        .single()
      if (cloneErr || !newSession) return { action: 'clone_session', success: false, message: cloneErr?.message || 'Failed to create cloned session' }

      // Copy scenarios
      const { data: srcScenarios } = await scopeToTeam(
        supabase.from('scenarios').select('*').eq('session_id', src.id).order('sort_order'),
        activeTeamId,
      )
      const oldToNew = new Map<string, string>()
      if (srcScenarios?.length) {
        const inserts = srcScenarios.map((scenario: { letter: string; title: string; description: string | null; device_requirement: string | null; sort_order: number }) =>
          withTeamPayload({
            session_id: newSession.id,
            letter: scenario.letter,
            title: scenario.title,
            description: scenario.description,
            device_requirement: scenario.device_requirement,
            sort_order: scenario.sort_order,
          }, activeTeamId),
        )
        const { data: newScenarios } = await supabase.from('scenarios').insert(inserts).select()
        if (newScenarios) {
          srcScenarios.forEach((old: { id: string }, idx: number) => {
            if (newScenarios[idx]) oldToNew.set(old.id, newScenarios[idx].id)
          })
        }
      }

      // Optionally copy assignments
      if (action.include_assignments !== false && oldToNew.size > 0) {
        const { data: srcAssignments } = await scopeToTeam(
          supabase.from('assignments').select('*').eq('session_id', src.id),
          activeTeamId,
        )
        if (srcAssignments?.length) {
          const assignInserts = srcAssignments
            .filter((assignment: { scenario_id: string }) => oldToNew.has(assignment.scenario_id))
            .map((assignment: { scenario_id: string; tester_id: string }) =>
              withTeamPayload({
                session_id: newSession.id,
                scenario_id: oldToNew.get(assignment.scenario_id)!,
                tester_id: assignment.tester_id,
              }, activeTeamId),
            )
          if (assignInserts.length) await supabase.from('assignments').insert(assignInserts)
        }
      }

      ctx.onSessionCreated(newSession.id)
      const parts = [`Session "${cloneName}" created from "${src.name}"`]
      if (srcScenarios?.length) parts.push(`${srcScenarios.length} scenario${srcScenarios.length !== 1 ? 's' : ''} copied`)
      if (action.include_assignments !== false && oldToNew.size > 0) parts.push('with assignments')
      return { action: 'clone_session', success: true, sessionId: newSession.id, sessionName: cloneName, message: `${parts.join(' — ')}!` }
    }

    case 'copy_scenarios': {
      const fromName = action.from_session?.trim()
      if (!fromName || !sessionId) return { action: 'copy_scenarios', success: false, message: !sessionId ? 'Create a session first' : 'Source session name required' }
      // Find source session by name
      const { data: srcSessions } = await scopeToTeam(
        supabase
          .from('sessions')
          .select('id')
          .ilike('name', fromName)
          .limit(1),
        activeTeamId,
      )
      if (!srcSessions?.length) return { action: 'copy_scenarios', success: false, message: `Session "${fromName}" not found` }
      const srcId = srcSessions[0].id
      // Fetch scenarios
      const { data: scenarios } = await scopeToTeam(
        supabase
          .from('scenarios')
          .select('letter, title, description, device_requirement, sort_order')
          .eq('session_id', srcId)
          .order('sort_order'),
        activeTeamId,
      )
      if (!scenarios?.length) return { action: 'copy_scenarios', success: false, message: `No scenarios found in "${fromName}"` }
      // Insert copies
      const copies = scenarios.map((s: { letter: string; title: string; description: string | null; device_requirement: string | null; sort_order: number }) =>
        withTeamPayload({
          session_id: sessionId,
          letter: s.letter,
          title: s.title,
          description: s.description,
          device_requirement: s.device_requirement,
          sort_order: s.sort_order,
        }, activeTeamId),
      )
      const { error: insErr } = await supabase.from('scenarios').insert(copies)
      if (insErr) return { action: 'copy_scenarios', success: false, message: insErr.message }
      return { action: 'copy_scenarios', success: true, sessionId: sessionId, message: `Copied ${scenarios.length} scenarios from "${fromName}"` }
    }

    case 'remove_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'remove_tester', success: false, message: 'Tester name required' }
      // Find the tester
      const { data: matchedTesters } = await scopeToTeam(
        supabase.from('testers').select('id, name').ilike('name', name).limit(1),
        activeTeamId,
      )
      if (!matchedTesters?.length) return { action: 'remove_tester', success: false, message: `Tester "${name}" not found` }
      // Deactivate in DB (same as toggling off on Testers page)
      const deactivateQuery = scopeToTeam(
        supabase.from('testers').update({ active: false }).eq('id', matchedTesters[0].id),
        activeTeamId,
      )
      const { error: deactivateErr } = await deactivateQuery
      if (deactivateErr) return { action: 'remove_tester', success: false, message: deactivateErr.message }
      return { action: 'remove_tester', success: true, sessionId: sessionId || undefined, message: `Deactivated ${matchedTesters[0].name} — they won't appear in any session pool` }
    }

    case 'add_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'add_tester', success: false, message: 'Tester name required' }
      // Check if they already exist
      const { data: existing } = await scopeToTeam(
        supabase.from('testers').select('id, name, active').ilike('name', name).limit(1),
        activeTeamId,
      )
      if (existing?.length) {
        if (!existing[0].active) {
          // Reactivate instead
          await scopeToTeam(
            supabase.from('testers').update({ active: true }).eq('id', existing[0].id),
            activeTeamId,
          )
          return { action: 'add_tester', success: true, sessionId: sessionId || undefined, message: `${existing[0].name} was inactive — reactivated them` }
        }
        return { action: 'add_tester', success: true, sessionId: sessionId || undefined, message: `${existing[0].name} already exists and is active` }
      }
      // Create new tester
      const { data: newTester, error: createErr } = await supabase
        .from('testers')
        .insert(withTeamPayload({ name, devices: [] }, activeTeamId))
        .select()
        .single()
      if (createErr || !newTester) return { action: 'add_tester', success: false, message: createErr?.message || 'Failed to create tester' }
      return { action: 'add_tester', success: true, sessionId: sessionId || undefined, message: `Created new tester "${newTester.name}" — they'll appear in session pools (no devices configured yet)` }
    }

    case 'reactivate_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'reactivate_tester', success: false, message: 'Tester name required' }
      const { data: matchedTesters } = await scopeToTeam(
        supabase.from('testers').select('id, name, active').ilike('name', name).limit(1),
        activeTeamId,
      )
      if (!matchedTesters?.length) return { action: 'reactivate_tester', success: false, message: `Tester "${name}" not found` }
      if (matchedTesters[0].active) return { action: 'reactivate_tester', success: true, sessionId: sessionId || undefined, message: `${matchedTesters[0].name} is already active` }
      const activateQuery = scopeToTeam(
        supabase.from('testers').update({ active: true }).eq('id', matchedTesters[0].id),
        activeTeamId,
      )
      const { error: activateErr } = await activateQuery
      if (activateErr) return { action: 'reactivate_tester', success: false, message: activateErr.message }
      return { action: 'reactivate_tester', success: true, sessionId: sessionId || undefined, message: `Reactivated ${matchedTesters[0].name} — they'll appear in session pools again` }
    }

    case 'delete_tester': {
      const name = action.tester?.trim()
      if (!name) return { action: 'delete_tester', success: false, message: 'Tester name required' }
      const { data: matchedTesters } = await scopeToTeam(
        supabase.from('testers').select('id, name').ilike('name', name).limit(1),
        activeTeamId,
      )
      if (!matchedTesters?.length) return { action: 'delete_tester', success: false, message: `Tester "${name}" not found` }
      // Check for assignment dependencies
      const { count: assignmentCount, error: assignmentErr } = await scopeToTeam(
        supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('tester_id', matchedTesters[0].id),
        activeTeamId,
      )
      if (assignmentErr) {
        return { action: 'delete_tester', success: false, message: `Failed to verify assignments: ${assignmentErr.message}` }
      }

      // Check for bug dependencies via tester_id (preferred)
      let bugCount = 0
      const bugByIdRes = await scopeToTeam(
        supabase
          .from('bugs')
          .select('*', { count: 'exact', head: true })
          .eq('tester_id', matchedTesters[0].id),
        activeTeamId,
      )
      if (bugByIdRes.error) {
        // Backward compatibility for databases that haven't added bugs.tester_id yet
        if (!bugByIdRes.error.message.toLowerCase().includes('tester_id')) {
          return { action: 'delete_tester', success: false, message: `Failed to verify bug dependencies: ${bugByIdRes.error.message}` }
        }
        const legacyBugRes = await scopeToTeam(
          supabase
            .from('bugs')
            .select('*', { count: 'exact', head: true })
            .ilike('tester', matchedTesters[0].name),
          activeTeamId,
        )
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

      const deleteTesterQuery = scopeToTeam(
        supabase.from('testers').delete().eq('id', matchedTesters[0].id),
        activeTeamId,
      )
      const { error: delErr } = await deleteTesterQuery
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
      const { data: testers } = await scopeToTeam(
        supabase.from('testers').select('id, name').ilike('name', testerName).limit(1),
        activeTeamId,
      )
      if (!testers?.length) return { action: 'assign_tester', success: false, message: `Tester "${testerName}" not found` }
      // Find scenario
      const { data: scenarios } = await scopeToTeam(
        supabase
          .from('scenarios')
          .select('id, letter')
          .eq('session_id', sessionId)
          .ilike('letter', scenarioLetter)
          .limit(1),
        activeTeamId,
      )
      if (!scenarios?.length) return { action: 'assign_tester', success: false, message: `Scenario "${scenarioLetter}" not found in this session` }
      // Upsert assignment
      const existingAssign = await scopeToTeam(
        supabase
          .from('assignments')
          .select('id')
          .eq('session_id', sessionId)
          .eq('scenario_id', scenarios[0].id)
          .limit(1),
        activeTeamId,
      )
      if (existingAssign.data?.length) {
        await scopeToTeam(
          supabase.from('assignments').delete().eq('id', existingAssign.data[0].id),
          activeTeamId,
        )
      }
      const { error: insErr } = await supabase
        .from('assignments')
        .insert(withTeamPayload({
          session_id: sessionId,
          scenario_id: scenarios[0].id,
          tester_id: testers[0].id,
        }, activeTeamId))
      if (insErr) return { action: 'assign_tester', success: false, message: insErr.message }
      return { action: 'assign_tester', success: true, sessionId: sessionId, message: `Assigned ${testers[0].name} to scenario ${scenarios[0].letter}` }
    }

    case 'delete_scenarios': {
      const letters = action.scenarios?.map(l => l.trim().toUpperCase()).filter(Boolean)
      if (!letters?.length || !sessionId) return { action: 'delete_scenarios', success: false, message: !sessionId ? 'No session in context' : 'Scenario letters required' }

      // Bulk-fetch all matching scenarios in one query
      const { data: matchedScenarios } = await scopeToTeam(
        supabase.from('scenarios').select('id, letter').eq('session_id', sessionId),
        activeTeamId,
      )
      const found = (matchedScenarios || []).filter(s => letters.includes(s.letter.toUpperCase()))
      const foundLetters = new Set(found.map(s => s.letter.toUpperCase()))
      const notFound = letters.filter(l => !foundLetters.has(l))

      if (found.length) {
        const scenarioIds = found.map(s => s.id)
        // Bulk delete assignments and scenarios
        await scopeToTeam(supabase.from('assignments').delete().in('scenario_id', scenarioIds), activeTeamId)
        await scopeToTeam(supabase.from('scenarios').delete().in('id', scenarioIds), activeTeamId)
      }

      const deleted = found.map(s => s.letter)
      const parts: string[] = []
      if (deleted.length) parts.push(`Deleted scenario${deleted.length > 1 ? 's' : ''} ${deleted.join(', ')}`)
      if (notFound.length) parts.push(`${notFound.join(', ')} not found`)
      return { action: 'delete_scenarios', success: deleted.length > 0, sessionId, message: parts.join('. ') }
    }

    case 'delete_session': {
      const sessionName = action.name?.trim()
      if (!sessionName) return { action: 'delete_session', success: false, message: 'Session name required' }
      const { data: sessions } = await scopeToTeam(
        supabase.from('sessions').select('id, name').ilike('name', sessionName).limit(1),
        activeTeamId,
      )
      if (!sessions?.length) return { action: 'delete_session', success: false, message: `Session "${sessionName}" not found` }
      const sid = sessions[0].id
      await scopeToTeam(
        supabase.from('assignments').delete().eq('session_id', sid),
        activeTeamId,
      )
      await scopeToTeam(
        supabase.from('scenarios').delete().eq('session_id', sid),
        activeTeamId,
      )
      await scopeToTeam(
        supabase.from('session_feedback').delete().eq('session_id', sid),
        activeTeamId,
      )
      const deleteSessionQuery = scopeToTeam(
        supabase.from('sessions').delete().eq('id', sid),
        activeTeamId,
      )
      const { error } = await deleteSessionQuery
      if (error) return { action: 'delete_session', success: false, message: error.message }
      // Notify about deletion
      if (sessionId === sid) {
        ctx.onSessionCreated(null as unknown as string) // clears current session
      }
      useNotificationStore.getState().notifySessionDeleted(sid)
      return { action: 'delete_session', success: true, message: `Deleted session "${sessions[0].name}" and all its data` }
    }

    // ─── Bug Actions ──────────────────────────────────────────

    case 'create_bug': {
      const title = action.title?.trim()
      if (!title) return { action: 'create_bug', success: false, message: 'Bug title is required' }

      // Duplicate detection
      const { data: existingBugs } = await scopeToTeam(
        supabase.from('bugs').select('id, title, severity, reviewed').order('created_at', { ascending: false }).limit(50),
        activeTeamId,
      )
      if (existingBugs?.length) {
        const titleLower = title.toLowerCase()
        const titleWords = titleLower.split(/\s+/).filter((word) => word.length > 2)
        const duplicates = existingBugs.filter((bug: { id: string; title: string; severity: string; reviewed: boolean }) => {
          const bugTitleLower = bug.title.toLowerCase()
          if (bugTitleLower === titleLower) return true
          const matchCount = titleWords.filter((word) => bugTitleLower.includes(word)).length
          return titleWords.length > 0 && matchCount / titleWords.length >= 0.6
        }).slice(0, 3)
        if (duplicates.length > 0) {
          const dupList = duplicates.map((dup: { id: string; title: string; reviewed: boolean }) =>
            `• ${dup.id}: "${dup.title}"${dup.reviewed ? ' (completed)' : ''}`
          ).join('\n')
          return {
            action: 'create_bug',
            success: false,
            level: 'warning',
            message: `Found similar bug(s) that might be duplicates:\n${dupList}\n\nShould I still create this bug, or is it a duplicate of one of these?`,
          }
        }
      }

      const severity = parseSeverity(action.severity)
      const id = await generateBugId(severity, activeTeamId)
      const resolvedTester = action.tester?.trim() || ctx.currentUserName || 'Unknown'
      let testerName = resolvedTester
      let testerId: string | null = null

      if (resolvedTester !== 'Unknown') {
        const { data: testerMatch } = await scopeToTeam(
          supabase.from('testers').select('id, name').ilike('name', resolvedTester).limit(1),
          activeTeamId,
        )
        if (testerMatch?.length) {
          testerName = testerMatch[0].name
          testerId = testerMatch[0].id
        }
      }

      const bugData = withTeamPayload({
        id,
        title,
        description: action.description?.trim() || '',
        severity,
        tester: testerName,
        tester_id: testerId,
        device: action.device?.trim() || '—',
        page: action.page?.trim() || '—',
        category: action.category?.trim() || null,
        reviewed: false,
      }, activeTeamId) as Record<string, unknown>

      try {
        const finalId = await insertBugWithRetry(supabase, bugData, id)
        return { action: 'create_bug', success: true, message: `Created bug ${finalId} "${title}"` }
      } catch (err) {
        return { action: 'create_bug', success: false, message: err instanceof Error ? err.message : String(err) }
      }
    }

    case 'edit_bug': {
      const bugQuery = action.bug?.trim()
      if (!bugQuery) return { action: 'edit_bug', success: false, message: 'Bug reference required' }
      const bug = await findBugByQuery(bugQuery, activeTeamId)
      if (!bug) return { action: 'edit_bug', success: false, message: `Bug "${bugQuery}" not found` }

      const updates: Record<string, unknown> = {}
      if (action.title) updates.title = action.title
      if (action.description) updates.description = action.description
      if (action.severity) {
        const nextSeverity = parseSeverity(action.severity)
        updates.severity = nextSeverity
        const baseTitle = String(updates.title ?? bug.title)
        updates.title = syncSeverityPrefixInTitle(baseTitle, bug.severity, nextSeverity)
      }
      if (action.tester) {
        updates.tester = action.tester
        // Try to resolve tester_id
        const { data: testerMatch } = await scopeToTeam(
          supabase.from('testers').select('id').ilike('name', action.tester).limit(1),
          activeTeamId,
        )
        if (testerMatch?.length) updates.tester_id = testerMatch[0].id
      }
      if (action.device) updates.device = action.device
      if (action.page) updates.page = action.page
      if (action.category !== undefined) updates.category = action.category || null

      if (Object.keys(updates).length === 0) return { action: 'edit_bug', success: false, message: 'No fields to update' }

      const updateBugQuery = scopeToTeam(
        supabase.from('bugs').update(updates).eq('id', bug.id),
        activeTeamId,
      )
      const { error } = await updateBugQuery
      if (error) return { action: 'edit_bug', success: false, message: error.message }
      const fields = Object.keys(updates).join(', ')
      return { action: 'edit_bug', success: true, message: `Updated ${bug.id} "${bug.title}" — changed: ${fields}` }
    }

    case 'resolve_bug': {
      const bugQuery = action.bug?.trim()
      if (!bugQuery) return { action: 'resolve_bug', success: false, message: 'Bug reference required' }
      const bug = await findBugByQuery(bugQuery, activeTeamId)
      if (!bug) return { action: 'resolve_bug', success: false, message: `Bug "${bugQuery}" not found` }
      const resolveBugQuery = scopeToTeam(
        supabase.from('bugs').update({ reviewed: true }).eq('id', bug.id),
        activeTeamId,
      )
      const { error } = await resolveBugQuery
      if (error) return { action: 'resolve_bug', success: false, message: error.message }
      return { action: 'resolve_bug', success: true, message: `Marked ${bug.id} "${bug.title}" as completed` }
    }

    case 'reopen_bug': {
      const bugQuery = action.bug?.trim()
      if (!bugQuery) return { action: 'reopen_bug', success: false, message: 'Bug reference required' }
      const bug = await findBugByQuery(bugQuery, activeTeamId)
      if (!bug) return { action: 'reopen_bug', success: false, message: `Bug "${bugQuery}" not found` }
      const reopenBugQuery = scopeToTeam(
        supabase.from('bugs').update({ reviewed: false }).eq('id', bug.id),
        activeTeamId,
      )
      const { error } = await reopenBugQuery
      if (error) return { action: 'reopen_bug', success: false, message: error.message }
      return { action: 'reopen_bug', success: true, message: `Reopened ${bug.id} "${bug.title}" — it's active again` }
    }

    case 'delete_bug': {
      const bugQuery = action.bug?.trim()
      if (!bugQuery) return { action: 'delete_bug', success: false, message: 'Bug reference required' }
      const bug = await findBugByQuery(bugQuery, activeTeamId)
      if (!bug) return { action: 'delete_bug', success: false, message: `Bug "${bugQuery}" not found` }
      // Delete comments and attachments first
      await scopeToTeam(
        supabase.from('comments').delete().eq('bug_id', bug.id),
        activeTeamId,
      )
      await scopeToTeam(
        supabase.from('attachments').delete().eq('bug_id', bug.id),
        activeTeamId,
      )
      const deleteBugQuery = scopeToTeam(
        supabase.from('bugs').delete().eq('id', bug.id),
        activeTeamId,
      )
      const { error } = await deleteBugQuery
      if (error) return { action: 'delete_bug', success: false, message: error.message }
      return { action: 'delete_bug', success: true, message: `Permanently deleted bug ${bug.id} "${bug.title}"` }
    }

    case 'bulk_resolve': {
      const bugIds = action.bugs
      if (!bugIds?.length) return { action: 'bulk_resolve', success: false, message: 'Specify which bugs to resolve (e.g. ["HI-01", "HI-02"])' }

      const resolved: string[] = []
      const failed: string[] = []
      for (const bugRef of bugIds) {
        const bug = await findBugByQuery(bugRef, activeTeamId)
        if (!bug) { failed.push(bugRef); continue }
        const { error } = await scopeToTeam(
          supabase.from('bugs').update({ reviewed: true }).eq('id', bug.id),
          activeTeamId,
        )
        if (error) { failed.push(bug.id); continue }
        resolved.push(bug.id)
      }

      const parts: string[] = []
      if (resolved.length) parts.push(`Resolved ${resolved.length} bug(s): ${resolved.join(', ')}`)
      if (failed.length) parts.push(`Failed to resolve: ${failed.join(', ')}`)
      return { action: 'bulk_resolve', success: resolved.length > 0, message: parts.join('. ') }
    }

    case 'bulk_delete': {
      const bugIds = action.bugs
      if (!bugIds?.length) return { action: 'bulk_delete', success: false, message: 'Specify which bugs to delete (e.g. ["LO-01", "LO-02"])' }

      const deleted: string[] = []
      const failed: string[] = []
      for (const bugRef of bugIds) {
        const bug = await findBugByQuery(bugRef, activeTeamId)
        if (!bug) { failed.push(bugRef); continue }
        await scopeToTeam(supabase.from('comments').delete().eq('bug_id', bug.id), activeTeamId)
        await scopeToTeam(supabase.from('attachments').delete().eq('bug_id', bug.id), activeTeamId)
        const { error } = await scopeToTeam(
          supabase.from('bugs').delete().eq('id', bug.id),
          activeTeamId,
        )
        if (error) { failed.push(bug.id); continue }
        deleted.push(bug.id)
      }

      const parts: string[] = []
      if (deleted.length) parts.push(`Deleted ${deleted.length} bug(s): ${deleted.join(', ')}`)
      if (failed.length) parts.push(`Failed to delete: ${failed.join(', ')}`)
      return { action: 'bulk_delete', success: deleted.length > 0, message: parts.join('. ') }
    }

    case 'export_bugs': {
      const format = action.format || 'csv'
      return {
        action: 'export_bugs',
        success: true,
        exportFormat: format,
        message: `Exporting bugs as ${format.toUpperCase()}...`,
      }
    }

    case 'add_comment': {
      const bugQuery = action.bug?.trim()
      const comment = action.comment?.trim()
      if (!bugQuery) return { action: 'add_comment', success: false, message: 'Bug reference required' }
      if (!comment) return { action: 'add_comment', success: false, message: 'Comment text required' }
      const bug = await findBugByQuery(bugQuery, activeTeamId)
      if (!bug) return { action: 'add_comment', success: false, message: `Bug "${bugQuery}" not found` }
      const mentionedUserIds = await resolveMentionedUserIds(comment, action.mentions, activeTeamId)
      const { data, error } = await supabase.from('comments').insert(withTeamPayload({
        bug_id: bug.id,
        text: comment,
        time: new Date().toLocaleString(),
        mentioned_user_ids: mentionedUserIds,
      }, activeTeamId)).select('id')
      if (error) return { action: 'add_comment', success: false, message: error.message }
      if (data?.[0]?.id) void notifyMentionedUsersFromAction(bug.id, data[0].id as number, mentionedUserIds)
      const mentionText = mentionedUserIds.length ? ` and notified ${mentionedUserIds.length} mentioned user${mentionedUserIds.length === 1 ? '' : 's'}` : ''
      return { action: 'add_comment', success: true, message: `Added comment to ${bug.id} "${bug.title}"${mentionText}` }
    }

    // ─── Scenario Actions ─────────────────────────────────────

    case 'add_scenario': {
      if (!sessionId) return { action: 'add_scenario', success: false, message: 'No session in context — create or select a session first' }
      const letter = action.letter?.trim().toUpperCase()
      const title = action.title?.trim()
      if (!letter || !title) return { action: 'add_scenario', success: false, message: 'Scenario letter and title are required' }

      // Check if letter already exists
      const { data: existing } = await scopeToTeam(
        supabase.from('scenarios').select('id').eq('session_id', sessionId).ilike('letter', letter).limit(1),
        activeTeamId,
      )
      if (existing?.length) return { action: 'add_scenario', success: false, message: `Scenario "${letter}" already exists in this session` }

      // Get next sort order
      const { count } = await scopeToTeam(
        supabase.from('scenarios').select('*', { count: 'exact', head: true }).eq('session_id', sessionId),
        activeTeamId,
      )
      const { error } = await supabase.from('scenarios').insert(withTeamPayload({
        session_id: sessionId,
        letter,
        title,
        description: action.description || null,
        device_requirement: action.device_requirement || null,
        sort_order: (count ?? 0) + 1,
      }, activeTeamId))
      if (error) return { action: 'add_scenario', success: false, message: error.message }
      return { action: 'add_scenario', success: true, sessionId, message: `Created scenario ${letter}: "${title}"` }
    }

    case 'edit_scenario': {
      if (!sessionId) return { action: 'edit_scenario', success: false, message: 'No session in context' }
      const letter = action.letter?.trim().toUpperCase()
      if (!letter) return { action: 'edit_scenario', success: false, message: 'Scenario letter required' }

      const { data: scenarios } = await scopeToTeam(
        supabase.from('scenarios').select('id, letter, title').eq('session_id', sessionId).ilike('letter', letter).limit(1),
        activeTeamId,
      )
      if (!scenarios?.length) return { action: 'edit_scenario', success: false, message: `Scenario "${letter}" not found in this session` }

      const updates: Record<string, unknown> = {}
      if (action.title) updates.title = action.title
      if (action.description !== undefined) updates.description = action.description || null
      if (action.device_requirement !== undefined) updates.device_requirement = action.device_requirement || null

      if (Object.keys(updates).length === 0) return { action: 'edit_scenario', success: false, message: 'No fields to update' }

      const updateScenarioQuery = scopeToTeam(
        supabase.from('scenarios').update(updates).eq('id', scenarios[0].id),
        activeTeamId,
      )
      const { error } = await updateScenarioQuery
      if (error) return { action: 'edit_scenario', success: false, message: error.message }
      const fields = Object.keys(updates).join(', ')
      return { action: 'edit_scenario', success: true, sessionId, message: `Updated scenario ${scenarios[0].letter} — changed: ${fields}` }
    }

    // ─── Session Status ───────────────────────────────────────

    case 'set_session_status': {
      const status = action.status?.trim().toLowerCase()
      if (!status || !['draft', 'active', 'completed'].includes(status)) {
        return { action: 'set_session_status', success: false, message: 'Status must be "draft", "active", or "completed"' }
      }

      let targetId = sessionId
      let targetName = 'current session'

      if (action.name?.trim()) {
        const { data: sessions } = await scopeToTeam(
          supabase.from('sessions').select('id, name').ilike('name', action.name.trim()).limit(1),
          activeTeamId,
        )
        if (!sessions?.length) return { action: 'set_session_status', success: false, message: `Session "${action.name}" not found` }
        targetId = sessions[0].id
        targetName = sessions[0].name
      }

      if (!targetId) return { action: 'set_session_status', success: false, message: 'No session in context — specify a session name' }

      const setStatusQuery = scopeToTeam(
        supabase.from('sessions').update({ status }).eq('id', targetId),
        activeTeamId,
      )
      const { error } = await setStatusQuery
      if (error) return { action: 'set_session_status', success: false, message: error.message }
      return { action: 'set_session_status', success: true, sessionId: targetId, message: `Session "${targetName}" is now ${status}` }
    }

    // ─── Tester Editing ───────────────────────────────────────

    case 'edit_tester': {
      const testerName = action.tester?.trim()
      if (!testerName) return { action: 'edit_tester', success: false, message: 'Tester name required' }

      const { data: matchedTesters } = await scopeToTeam(
        supabase.from('testers').select('id, name, devices').ilike('name', testerName).limit(1),
        activeTeamId,
      )
      if (!matchedTesters?.length) return { action: 'edit_tester', success: false, message: `Tester "${testerName}" not found` }

      const tester = matchedTesters[0]
      const updates: Record<string, unknown> = {}

      if (action.name && action.name.trim() !== tester.name) updates.name = action.name.trim()
      if (action.devices) updates.devices = action.devices

      if (Object.keys(updates).length === 0) return { action: 'edit_tester', success: false, message: 'No changes to make' }

      const updateTesterQuery = scopeToTeam(
        supabase.from('testers').update(updates).eq('id', tester.id),
        activeTeamId,
      )
      const { error } = await updateTesterQuery
      if (error) return { action: 'edit_tester', success: false, message: error.message }
      const fields = Object.keys(updates).join(', ')
      return { action: 'edit_tester', success: true, message: `Updated tester "${tester.name}" — changed: ${fields}` }
    }

    // ─── Team & Product Actions ──────────────────────────────

    case 'create_team': {
      const name = action.name?.trim()
      if (!name) return { action: 'create_team', success: false, message: 'Team name is required' }
      const slug = slugifyTeamName(name)
      // Check if team already exists
      const { data: existing } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', ORGANIZATION_ID)
        .ilike('slug', slug)
        .limit(1)
      if (existing?.length) return { action: 'create_team', success: false, message: `Team "${existing[0].name}" already exists with slug "${slug}"` }
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({ organization_id: ORGANIZATION_ID, name, slug })
        .select()
        .single()
      if (teamErr || !newTeam) return { action: 'create_team', success: false, message: teamErr?.message || 'Failed to create team' }
      return { action: 'create_team', success: true, message: `Created team "${name}" (slug: ${slug})` }
    }

    case 'create_product': {
      const productName = action.name?.trim()
      const teamName = action.team?.trim()
      if (!productName) return { action: 'create_product', success: false, message: 'Product name is required' }
      if (!teamName) return { action: 'create_product', success: false, message: 'Team name is required — specify which team this product belongs to' }

      // Find team
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', ORGANIZATION_ID)
        .ilike('name', teamName)
        .limit(1)
      if (!teams?.length) return { action: 'create_product', success: false, message: `Team "${teamName}" not found` }
      const teamId = teams[0].id

      const slug = slugifyTeamName(productName)
      // Check duplicate
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id, name')
        .eq('team_id', teamId)
        .ilike('slug', slug)
        .limit(1)
      if (existingProduct?.length) return { action: 'create_product', success: false, message: `Product "${existingProduct[0].name}" already exists in ${teams[0].name}` }

      const insertData: Record<string, unknown> = { team_id: teamId, name: productName, slug }
      if (action.description?.trim()) insertData.description = action.description.trim()
      if (action.link?.trim()) insertData.link = action.link.trim()

      const { error: prodErr } = await supabase.from('products').insert(insertData)
      if (prodErr) return { action: 'create_product', success: false, message: prodErr.message }
      const extras: string[] = []
      if (action.description?.trim()) extras.push('description')
      if (action.link?.trim()) extras.push('link')
      return { action: 'create_product', success: true, message: `Created product "${productName}" in ${teams[0].name}${extras.length ? ` (with ${extras.join(' and ')})` : ''}` }
    }

    case 'edit_product': {
      const productName = action.name?.trim()
      const teamName = action.team?.trim()
      if (!productName && !teamName) return { action: 'edit_product', success: false, message: 'Specify the product name to edit' }

      // Find product by name (optionally scoped to team)
      let productQuery = supabase.from('products').select('id, name, team_id, description, link')
      if (productName) productQuery = productQuery.ilike('name', productName)
      const { data: matchedProducts } = await productQuery.limit(5)

      if (!matchedProducts?.length) return { action: 'edit_product', success: false, message: `Product "${productName || ''}" not found` }

      // If multiple matches and team specified, narrow down
      let product = matchedProducts[0]
      if (matchedProducts.length > 1 && teamName) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .eq('organization_id', ORGANIZATION_ID)
          .ilike('name', teamName)
          .limit(1)
        if (teams?.length) {
          const match = matchedProducts.find((p: { team_id: string }) => p.team_id === teams[0].id)
          if (match) product = match
        }
      }

      const updates: Record<string, unknown> = {}
      if (action.description !== undefined) updates.description = action.description?.trim() || null
      if (action.link !== undefined) updates.link = action.link?.trim() || null
      // Allow renaming via title field (reuse existing 'title' on SessionAction)
      if (action.title?.trim()) {
        updates.name = action.title.trim()
        updates.slug = slugifyTeamName(action.title.trim())
      }

      if (Object.keys(updates).length === 0) return { action: 'edit_product', success: false, message: 'No fields to update' }

      const { error: updErr } = await supabase.from('products').update(updates).eq('id', product.id)
      if (updErr) return { action: 'edit_product', success: false, message: updErr.message }
      const fields = Object.keys(updates).filter(k => k !== 'slug').join(', ')
      return { action: 'edit_product', success: true, message: `Updated product "${product.name}" — changed: ${fields}` }
    }

    default:
      return { action: action.action, success: false, message: 'Unknown action' }
  }
}

export async function executeSessionAction(
  action: SessionAction,
  ctx: ActionContext,
): Promise<SessionActionResult> {
  const result = await executeSessionActionWithSession(action, ctx)
  if (result.success) {
    if (SESSION_ACTIONS.has(action.action)) queryClient.invalidateQueries({ queryKey: ['sessions'] })
    if (TESTER_ACTIONS.has(action.action)) queryClient.invalidateQueries({ queryKey: ['testers'] })
    if (BUG_ACTIONS.has(action.action) || EXPORT_ACTIONS.has(action.action)) queryClient.invalidateQueries({ queryKey: ['bugs-data'] })
    if (TEAM_ACTIONS.has(action.action)) {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setTimeout(() => useNotificationStore.getState().notifyTeamDataChanged(), 0)
    }
  }
  return result
}
