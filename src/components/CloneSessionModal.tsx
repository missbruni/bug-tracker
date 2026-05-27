import React from 'react'
import { X, Copy } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { scopeToTeam, withTeamPayload } from '../lib/teamScope'
import type { Session, Scenario, Assignment } from '../hooks/useBugs'

interface CloneSessionModalProps {
  session: Pick<Session, 'id' | 'name' | 'product_id' | 'team_id'>
  activeTeamId: string | null
  onCloned: (newSessionId: string) => void
  onClose: () => void
}

export default function CloneSessionModal({ session, activeTeamId, onCloned, onClose }: CloneSessionModalProps) {
  const [name, setName] = React.useState(`Copy of ${session.name}`)
  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0])
  const [includeAssignments, setIncludeAssignments] = React.useState(true)
  const [cloning, setCloning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleClone = async () => {
    if (!supabase || !name.trim() || cloning) return
    setCloning(true)
    setError(null)

    try {
      // 1. Create new session
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert(withTeamPayload({
          name: name.trim(),
          date: date || null,
          status: 'draft',
          product_id: session.product_id || null,
        }, activeTeamId))
        .select()
        .single()

      if (sessionError || !newSession) {
        setError(sessionError?.message || 'Failed to create session')
        return
      }

      // 2. Copy scenarios
      const { data: sourceScenarios } = await scopeToTeam(
        supabase.from('scenarios').select('*').eq('session_id', session.id).order('sort_order'),
        activeTeamId,
      )

      const scenarioRows = sourceScenarios as Scenario[] | null
      const oldToNewScenarioId = new Map<string, string>()

      if (scenarioRows?.length) {
        const scenarioInserts = scenarioRows.map((scenario) =>
          withTeamPayload({
            session_id: newSession.id,
            letter: scenario.letter,
            title: scenario.title,
            description: scenario.description,
            device_requirement: scenario.device_requirement,
            sort_order: scenario.sort_order,
          }, activeTeamId),
        )

        const { data: newScenarios, error: scenarioError } = await supabase
          .from('scenarios')
          .insert(scenarioInserts)
          .select()

        if (scenarioError) {
          setError(`Session created but scenarios failed: ${scenarioError.message}`)
          onCloned(newSession.id)
          return
        }

        // Build old→new scenario ID mapping (order is preserved)
        if (newScenarios) {
          scenarioRows.forEach((old, index) => {
            if (newScenarios[index]) oldToNewScenarioId.set(old.id, newScenarios[index].id)
          })
        }
      }

      // 3. Optionally copy assignments
      if (includeAssignments && oldToNewScenarioId.size > 0) {
        const { data: sourceAssignments } = await scopeToTeam(
          supabase.from('assignments').select('*').eq('session_id', session.id),
          activeTeamId,
        )

        const assignmentRows = sourceAssignments as Assignment[] | null
        if (assignmentRows?.length) {
          const assignmentInserts = assignmentRows
            .filter((assignment) => oldToNewScenarioId.has(assignment.scenario_id))
            .map((assignment) =>
              withTeamPayload({
                session_id: newSession.id,
                scenario_id: oldToNewScenarioId.get(assignment.scenario_id)!,
                tester_id: assignment.tester_id,
              }, activeTeamId),
            )

          if (assignmentInserts.length) {
            await supabase.from('assignments').insert(assignmentInserts)
          }
        }
      }

      onCloned(newSession.id)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setCloning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!cloning) onClose() }}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-xl w-full max-w-sm mx-4 flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Duplicate Session</h2>
          <button
            onClick={onClose}
            disabled={cloning}
            className="p-1 rounded-md text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">Session name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={includeAssignments}
              onChange={(event) => setIncludeAssignments(event.target.checked)}
              className="rounded border-slate-300 dark:border-gray-600 text-blue-500 focus:ring-blue-400 cursor-pointer"
            />
            <span className="text-xs text-slate-600 dark:text-gray-400">Include tester assignments</span>
          </label>
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={cloning}
            className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={!name.trim() || cloning}
            className="flex items-center gap-1.5 rounded-md bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
          >
            <Copy size={12} />
            {cloning ? 'Cloning...' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  )
}
