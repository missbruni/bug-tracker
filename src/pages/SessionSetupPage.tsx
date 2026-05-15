import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Trash2, Lock, Shuffle, RotateCcw, Presentation, ChevronUp, ChevronDown, GripVertical, Pencil, X, Check } from 'lucide-react'
import { supabase } from '../supabaseClient'

interface Tester {
  id: string
  name: string
  devices: string[]
  active: boolean
}

interface Scenario {
  id: string
  session_id: string
  letter: string
  title: string
  description: string | null
  device_requirement: string | null
  sort_order: number
}

interface Assignment {
  id: string
  session_id: string
  scenario_id: string
  tester_id: string
}

interface Session {
  id: string
  name: string
  date: string | null
  status: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100 dark:bg-gray-800', text: 'text-slate-600 dark:text-gray-400' },
  active: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-400' },
  completed: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400' },
}

export default function SessionSetupPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [testers, setTesters] = useState<Tester[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)

  // Add/edit scenario state
  const [showAddScenario, setShowAddScenario] = useState(false)
  const [newLetter, setNewLetter] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDevice, setNewDevice] = useState('')

  const [editScenarioId, setEditScenarioId] = useState<string | null>(null)
  const [editLetter, setEditLetter] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDevice, setEditDevice] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !sessionId) return
    const [sessRes, scenRes, testRes, assignRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('scenarios').select('*').eq('session_id', sessionId).order('sort_order'),
      supabase.from('testers').select('*').eq('active', true).order('name'),
      supabase.from('assignments').select('*').eq('session_id', sessionId),
    ])
    if (sessRes.data) setSession(sessRes.data as Session)
    setScenarios((scenRes.data || []) as Scenario[])
    setTesters((testRes.data || []) as Tester[])
    setAssignments((assignRes.data || []) as Assignment[])
    setLoading(false)
  }, [sessionId])

  useEffect(() => { load() }, [load])

  const assignTester = async (scenarioId: string, testerId: string) => {
    if (!supabase || !sessionId) return
    // Remove any existing assignment for this scenario
    const existing = assignments.find(a => a.scenario_id === scenarioId)
    if (existing) {
      await supabase.from('assignments').delete().eq('id', existing.id)
    }
    const { data, error } = await supabase
      .from('assignments')
      .insert({ session_id: sessionId, scenario_id: scenarioId, tester_id: testerId })
      .select()
    if (!error && data?.[0]) {
      setAssignments(prev => [
        ...prev.filter(a => a.scenario_id !== scenarioId),
        data[0] as Assignment,
      ])
    }
    setSelectedScenarioId(null)
  }

  const unassign = async (scenarioId: string) => {
    if (!supabase) return
    const existing = assignments.find(a => a.scenario_id === scenarioId)
    if (existing) {
      const { error } = await supabase.from('assignments').delete().eq('id', existing.id)
      if (!error) setAssignments(prev => prev.filter(a => a.id !== existing.id))
    }
    setSelectedScenarioId(null)
  }

  const shuffleAssignments = async () => {
    if (!supabase || !sessionId) return
    const lockedScenarioIds = new Set(
      scenarios.filter(s => s.device_requirement && ['iPhone Safari', 'Android Chrome', 'iPad Safari'].includes(s.device_requirement))
        .map(s => s.id)
    )
    const lockedAssignments = assignments.filter(a => lockedScenarioIds.has(a.scenario_id))
    const lockedTesterIds = new Set(lockedAssignments.map(a => a.tester_id))

    const unlockedScenarios = scenarios.filter(s => !lockedScenarioIds.has(s.id))
    const availableTesters = testers.filter(t => !lockedTesterIds.has(t.id))

    // Fisher-Yates shuffle
    const shuffled = [...availableTesters]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Delete existing non-locked assignments
    const toDelete = assignments.filter(a => !lockedScenarioIds.has(a.scenario_id))
    for (const a of toDelete) {
      await supabase.from('assignments').delete().eq('id', a.id)
    }

    // Create new assignments
    const newAssignments: Assignment[] = [...lockedAssignments]
    for (let i = 0; i < unlockedScenarios.length && i < shuffled.length; i++) {
      const { data } = await supabase
        .from('assignments')
        .insert({ session_id: sessionId, scenario_id: unlockedScenarios[i].id, tester_id: shuffled[i].id })
        .select()
      if (data?.[0]) newAssignments.push(data[0] as Assignment)
    }
    setAssignments(newAssignments)
  }

  const resetAssignments = async () => {
    if (!supabase || !sessionId) return
    await supabase.from('assignments').delete().eq('session_id', sessionId)
    setAssignments([])
  }

  const addScenario = async () => {
    if (!supabase || !sessionId || !newLetter.trim() || !newTitle.trim()) return
    const maxOrder = scenarios.length ? Math.max(...scenarios.map(s => s.sort_order)) : 0
    const { data, error } = await supabase
      .from('scenarios')
      .insert({
        session_id: sessionId,
        letter: newLetter.trim().toUpperCase(),
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        device_requirement: newDevice.trim() || null,
        sort_order: maxOrder + 1,
      })
      .select()
    if (!error && data?.[0]) {
      setScenarios(prev => [...prev, data[0] as Scenario])
      setNewLetter('')
      setNewTitle('')
      setNewDesc('')
      setNewDevice('')
      setShowAddScenario(false)
    }
  }

  const deleteScenario = async (id: string) => {
    if (!supabase) return
    const { error } = await supabase.from('scenarios').delete().eq('id', id)
    if (!error) {
      setScenarios(prev => prev.filter(s => s.id !== id))
      setAssignments(prev => prev.filter(a => a.scenario_id !== id))
    }
  }

  const moveScenario = async (id: string, direction: 'up' | 'down') => {
    if (!supabase) return
    const idx = scenarios.findIndex(s => s.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= scenarios.length) return

    const a = scenarios[idx]
    const b = scenarios[swapIdx]
    await Promise.all([
      supabase.from('scenarios').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('scenarios').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    const updated = [...scenarios]
    updated[idx] = { ...a, sort_order: b.sort_order }
    updated[swapIdx] = { ...b, sort_order: a.sort_order }
    updated.sort((x, y) => x.sort_order - y.sort_order)
    setScenarios(updated)
  }

  const startEditScenario = (s: Scenario) => {
    setEditScenarioId(s.id)
    setEditLetter(s.letter)
    setEditTitle(s.title)
    setEditDesc(s.description || '')
    setEditDevice(s.device_requirement || '')
  }

  const saveEditScenario = async () => {
    if (!supabase || !editScenarioId || !editLetter.trim() || !editTitle.trim()) return
    const { error } = await supabase
      .from('scenarios')
      .update({
        letter: editLetter.trim().toUpperCase(),
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        device_requirement: editDevice.trim() || null,
      })
      .eq('id', editScenarioId)
    if (!error) {
      setScenarios(prev => prev.map(s => s.id === editScenarioId ? {
        ...s,
        letter: editLetter.trim().toUpperCase(),
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        device_requirement: editDevice.trim() || null,
      } : s))
      setEditScenarioId(null)
    }
  }

  const cycleStatus = async () => {
    if (!supabase || !session) return
    const next = session.status === 'draft' ? 'active' : session.status === 'active' ? 'completed' : 'draft'
    const { error } = await supabase.from('sessions').update({ status: next }).eq('id', session.id)
    if (!error) setSession({ ...session, status: next })
  }

  const getAssignedTester = (scenarioId: string): Tester | null => {
    const a = assignments.find(a => a.scenario_id === scenarioId)
    if (!a) return null
    return testers.find(t => t.id === a.tester_id) || null
  }

  const isDeviceLocked = (s: Scenario): boolean => {
    return !!s.device_requirement && ['iPhone Safari', 'Android Chrome', 'iPad Safari'].includes(s.device_requirement)
  }

  const canAssign = (scenario: Scenario, tester: Tester): boolean => {
    if (!isDeviceLocked(scenario)) return true
    return tester.devices.includes(scenario.device_requirement!)
  }

  const assignedTesterIds = new Set(assignments.map(a => a.tester_id))

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Loading session...</div>
  }

  if (!session) {
    return <div className="flex items-center justify-center py-20 text-sm text-red-500">Session not found</div>
  }

  const st = STATUS_STYLES[session.status] || STATUS_STYLES.draft

  return (
    <div className="max-w-screen-2xl mx-auto px-7 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">{session.name}</h1>
            <button
              onClick={cycleStatus}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${st.bg} ${st.text} cursor-pointer hover:opacity-80 transition-opacity`}
            >
              {session.status}
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {scenarios.length} scenarios · {assignments.length} assigned · {testers.length} testers in pool
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/sessions/${sessionId}/present`}
            className="flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-white hover:bg-purple-600 transition-colors"
          >
            <Presentation size={16} /> Present
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scenarios */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Scenarios</h2>
            <button
              onClick={() => setShowAddScenario(true)}
              className="flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors cursor-pointer"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {showAddScenario && (
            <div className="mb-3 rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-900 p-4">
              <div className="grid grid-cols-[60px_1fr_1fr] gap-2 mb-2">
                <input value={newLetter} onChange={e => setNewLetter(e.target.value)} placeholder="Letter" maxLength={2}
                  className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-center font-bold text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500 uppercase" />
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Scenario title *"
                  className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500" />
                <input value={newDevice} onChange={e => setNewDevice(e.target.value)} placeholder="Device requirement (optional)"
                  className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500" />
              </div>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Step-by-step instructions" rows={4}
                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y mb-2 focus:border-blue-500" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddScenario(false)} className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 cursor-pointer">Cancel</button>
                <button onClick={addScenario} disabled={!newLetter.trim() || !newTitle.trim()} className="rounded-md bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:bg-slate-400 cursor-pointer disabled:cursor-default">Add</button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {scenarios.map((scenario, idx) => {
              const assigned = getAssignedTester(scenario.id)
              const locked = isDeviceLocked(scenario)
              const isSelected = selectedScenarioId === scenario.id
              const isEditing = editScenarioId === scenario.id

              if (isEditing) {
                return (
                  <div key={scenario.id} className="rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-900 p-4">
                    <div className="grid grid-cols-[60px_1fr_1fr] gap-2 mb-2">
                      <input value={editLetter} onChange={e => setEditLetter(e.target.value)} maxLength={2}
                        className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-center font-bold text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500 uppercase" />
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500" />
                      <input value={editDevice} onChange={e => setEditDevice(e.target.value)} placeholder="Device requirement"
                        className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500" />
                    </div>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                      className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y mb-2 focus:border-blue-500" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditScenarioId(null)} className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 cursor-pointer"><X size={14} /></button>
                      <button onClick={saveEditScenario} className="rounded-md bg-green-500 px-3 py-1.5 text-xs text-white font-semibold cursor-pointer hover:bg-green-600"><Check size={14} /></button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={scenario.id}
                  onClick={() => setSelectedScenarioId(isSelected ? null : scenario.id)}
                  className={`rounded-lg border bg-white dark:bg-gray-900 p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500/30'
                      : 'border-slate-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical size={14} className="text-slate-300 dark:text-gray-600 shrink-0" />
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-xs font-bold shrink-0">
                      {scenario.letter}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{scenario.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {scenario.device_requirement && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            {locked && <Lock size={10} />}
                            {scenario.device_requirement}
                          </span>
                        )}
                      </div>
                    </div>
                    {assigned ? (
                      <span className="inline-flex items-center rounded-full bg-blue-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        {assigned.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 dark:border-gray-600 px-2.5 py-0.5 text-[11px] text-slate-400 dark:text-gray-500">
                        Unassigned
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => moveScenario(scenario.id, 'up')} disabled={idx === 0}
                        className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => moveScenario(scenario.id, 'down')} disabled={idx === scenarios.length - 1}
                        className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                        <ChevronDown size={14} />
                      </button>
                      <button onClick={() => startEditScenario(scenario)}
                        className="p-1 text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteScenario(scenario.id)}
                        className="p-1 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Tester Pool */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Tester Pool</h2>
            <div className="flex gap-1.5">
              <button onClick={shuffleAssignments}
                className="flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors cursor-pointer">
                <Shuffle size={12} /> Shuffle
              </button>
              <button onClick={resetAssignments}
                className="flex items-center gap-1 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          {selectedScenarioId && (
            <div className="mb-3 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                Assign to: {scenarios.find(s => s.id === selectedScenarioId)?.letter} — {scenarios.find(s => s.id === selectedScenarioId)?.title}
              </p>
              {getAssignedTester(selectedScenarioId) && (
                <button onClick={() => unassign(selectedScenarioId)}
                  className="mb-2 rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 cursor-pointer">
                  Unassign {getAssignedTester(selectedScenarioId)?.name}
                </button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <p className="text-xs text-slate-500 dark:text-gray-500 mb-2">
              {selectedScenarioId ? 'Click a name to assign' : 'Click a scenario first, then a tester'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {testers.map(tester => {
                const used = assignedTesterIds.has(tester.id)
                const scenario = selectedScenarioId ? scenarios.find(s => s.id === selectedScenarioId) : null
                const eligible = scenario ? canAssign(scenario, tester) : true

                return (
                  <button
                    key={tester.id}
                    onClick={() => selectedScenarioId && eligible && !used && assignTester(selectedScenarioId, tester.id)}
                    disabled={!selectedScenarioId || used || !eligible}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      used
                        ? 'opacity-30 line-through border-slate-200 dark:border-gray-700 text-slate-400 dark:text-gray-600 cursor-default'
                        : !eligible
                        ? 'opacity-40 border-red-200 dark:border-red-800 text-red-400 dark:text-red-600 cursor-not-allowed'
                        : selectedScenarioId
                        ? 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'
                        : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 cursor-default'
                    }`}
                    title={!eligible ? `Missing device: ${scenario?.device_requirement}` : ''}
                  >
                    {tester.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick legend */}
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-[11px] text-slate-500 dark:text-gray-500 space-y-1">
            <p><Lock size={10} className="inline text-amber-500" /> = device-locked (only matching testers)</p>
            <p><span className="line-through">Name</span> = already assigned</p>
            <p><span className="text-red-400">Name</span> = missing required device</p>
          </div>
        </div>
      </div>
    </div>
  )
}
