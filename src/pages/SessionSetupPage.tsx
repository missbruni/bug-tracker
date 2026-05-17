import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Lock, Shuffle, RotateCcw, Presentation, ChevronUp, ChevronDown, GripVertical, Pencil, X, Check, MessageSquareHeart, AlertCircle, Package } from 'lucide-react'
import FeedbackModal from '../components/FeedbackModal'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam, withTeamPayload } from '../lib/teamScope'
import { SESSION_STATUS_STYLES } from '../constants'
import type { Tester, Scenario, Assignment, Session, SessionStatus } from '../types'

export default function SessionSetupPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const { activeTeamId } = useTeamAccess()
  const [session, setSession] = useState<Session | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [testers, setTesters] = useState<Tester[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingSession, setDeletingSession] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [teamName, setTeamName] = useState<string | null>(null)
  const [productName, setProductName] = useState<string | null>(null)
  const navigate = useNavigate()

  // Add/edit scenario state
  const [showAddScenario, setShowAddScenario] = useState(false)
  const [addingScenario, setAddingScenario] = useState(false)
  const [shufflingAssignments, setShufflingAssignments] = useState(false)
  const [resettingAssignments, setResettingAssignments] = useState(false)
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
      scopeToTeam(supabase.from('sessions').select('*').eq('id', sessionId).single(), activeTeamId),
      scopeToTeam(supabase.from('scenarios').select('*').eq('session_id', sessionId).order('sort_order'), activeTeamId),
      scopeToTeam(supabase.from('testers').select('*').eq('active', true).order('name'), activeTeamId),
      scopeToTeam(supabase.from('assignments').select('*').eq('session_id', sessionId), activeTeamId),
    ])
    if (sessRes.data) {
      setSession(sessRes.data as Session)
      // Fetch team name
      const sess = sessRes.data as Session
      if (sess.team_id) {
        supabase.from('teams').select('name').eq('id', sess.team_id).single().then(({ data: t }) => {
          if (t) setTeamName((t as { name: string }).name)
        })
      }
      // Fetch product name
      if (sess.product_id) {
        supabase.from('products').select('name').eq('id', sess.product_id).single().then(({ data: p }) => {
          if (p) setProductName((p as { name: string }).name)
        })
      }
    }
    setScenarios((scenRes.data || []) as Scenario[])
    const assigns = (assignRes.data || []) as Assignment[]
    setAssignments(assigns)

    // For completed sessions, also load inactive testers that have assignments
    let allTesters = (testRes.data || []) as Tester[]
    if (sessRes.data?.status === 'completed' && assigns.length) {
      const activeIds = new Set(allTesters.map(t => t.id))
      const missingIds = assigns.map(a => a.tester_id).filter(id => !activeIds.has(id))
      if (missingIds.length) {
        const { data: inactiveTesters } = await scopeToTeam(
          supabase.from('testers').select('*').in('id', missingIds),
          activeTeamId,
        )
        if (inactiveTesters?.length) {
          allTesters = [...allTesters, ...(inactiveTesters as Tester[])].sort((a, b) => a.name.localeCompare(b.name))
        }
      }
    }
    setTesters(allTesters)
    setLoading(false)
  }, [sessionId, activeTeamId])

  useEffect(() => { load() }, [load])

  // Reload when AI assistant modifies session data
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.sessionId || detail.sessionId === sessionId) {
        load()
      }
    }
    window.addEventListener('sessionDataChanged', handler)
    return () => window.removeEventListener('sessionDataChanged', handler)
  }, [load, sessionId])

  // Navigate away if this session is deleted via AI
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.sessionId === sessionId) navigate('/sessions')
    }
    window.addEventListener('sessionDeleted', handler)
    return () => window.removeEventListener('sessionDeleted', handler)
  }, [sessionId, navigate])

  const assignTester = async (scenarioId: string, testerId: string) => {
    if (!supabase || !sessionId) return
    // Remove any existing assignment for this scenario
    const existing = assignments.find(a => a.scenario_id === scenarioId)
    if (existing) {
      await scopeToTeam(supabase.from('assignments').delete().eq('id', existing.id), activeTeamId)
    }
    const { data, error } = await supabase
      .from('assignments')
      .insert(withTeamPayload({ session_id: sessionId, scenario_id: scenarioId, tester_id: testerId }, activeTeamId))
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
      const deleteQuery = scopeToTeam(supabase.from('assignments').delete().eq('id', existing.id), activeTeamId)
      const { error } = await deleteQuery
      if (!error) setAssignments(prev => prev.filter(a => a.id !== existing.id))
    }
    setSelectedScenarioId(null)
  }

  const shuffleAssignments = async () => {
    if (!supabase || !sessionId || shufflingAssignments || resettingAssignments) return
    setShufflingAssignments(true)
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

    try {
      // Delete existing non-locked assignments
      const toDelete = assignments.filter(a => !lockedScenarioIds.has(a.scenario_id))
      for (const a of toDelete) {
        await scopeToTeam(supabase.from('assignments').delete().eq('id', a.id), activeTeamId)
      }

      // Create new assignments
      const newAssignments: Assignment[] = [...lockedAssignments]
      for (let i = 0; i < unlockedScenarios.length && i < shuffled.length; i++) {
        const { data } = await supabase
          .from('assignments')
          .insert(withTeamPayload({ session_id: sessionId, scenario_id: unlockedScenarios[i].id, tester_id: shuffled[i].id }, activeTeamId))
          .select()
        if (data?.[0]) newAssignments.push(data[0] as Assignment)
      }
      setAssignments(newAssignments)
    } finally {
      setShufflingAssignments(false)
    }
  }

  const resetAssignments = async () => {
    if (!supabase || !sessionId || resettingAssignments || shufflingAssignments) return
    setResettingAssignments(true)
    try {
      await scopeToTeam(supabase.from('assignments').delete().eq('session_id', sessionId), activeTeamId)
      setAssignments([])
    } finally {
      setResettingAssignments(false)
    }
  }

  const addScenario = async () => {
    if (!supabase || !sessionId || !newLetter.trim() || !newTitle.trim() || addingScenario) return
    setAddingScenario(true)
    try {
      const maxOrder = scenarios.length ? Math.max(...scenarios.map(s => s.sort_order)) : 0
      const { data, error } = await supabase
        .from('scenarios')
        .insert(withTeamPayload({
          session_id: sessionId,
          letter: newLetter.trim().toUpperCase(),
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          device_requirement: newDevice.trim() || null,
          sort_order: maxOrder + 1,
        }, activeTeamId))
        .select()
      if (!error && data?.[0]) {
        setScenarios(prev => [...prev, data[0] as Scenario])
        setNewLetter('')
        setNewTitle('')
        setNewDesc('')
        setNewDevice('')
        setShowAddScenario(false)
      }
    } finally {
      setAddingScenario(false)
    }
  }

  const deleteScenario = async (id: string) => {
    if (!supabase) return
    const deleteQuery = scopeToTeam(supabase.from('scenarios').delete().eq('id', id), activeTeamId)
    const { error } = await deleteQuery
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
      scopeToTeam(supabase.from('scenarios').update({ sort_order: b.sort_order }).eq('id', a.id), activeTeamId),
      scopeToTeam(supabase.from('scenarios').update({ sort_order: a.sort_order }).eq('id', b.id), activeTeamId),
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
    const updateScenarioQuery = scopeToTeam(
      supabase
        .from('scenarios')
        .update({
          letter: editLetter.trim().toUpperCase(),
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          device_requirement: editDevice.trim() || null,
        })
        .eq('id', editScenarioId),
      activeTeamId,
    )
    const { error } = await updateScenarioQuery
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

  const setStatus = async (next: SessionStatus) => {
    if (!supabase || !session) return
    setShowStatusMenu(false)
    if (next === 'completed') {
      setShowCompleteConfirm(true)
      return
    }
    const statusQuery = scopeToTeam(
      supabase.from('sessions').update({ status: next }).eq('id', session.id),
      activeTeamId,
    )
    const { error } = await statusQuery
    if (!error) setSession({ ...session, status: next })
  }

  const confirmComplete = async () => {
    if (!supabase || !session) return
    const completeQuery = scopeToTeam(
      supabase.from('sessions').update({ status: 'completed' }).eq('id', session.id),
      activeTeamId,
    )
    const { error } = await completeQuery
    if (!error) setSession({ ...session, status: 'completed' })
    setShowCompleteConfirm(false)
  }

  const deleteSession = async () => {
    if (!supabase || !session || deleteConfirmText !== session.name || deletingSession) return
    setDeletingSession(true)
    try {
      await scopeToTeam(supabase.from('assignments').delete().eq('session_id', session.id), activeTeamId)
      await scopeToTeam(supabase.from('scenarios').delete().eq('session_id', session.id), activeTeamId)
      await scopeToTeam(supabase.from('session_feedback').delete().eq('session_id', session.id), activeTeamId)
      const deleteSessionQuery = scopeToTeam(
        supabase.from('sessions').delete().eq('id', session.id),
        activeTeamId,
      )
      const { error } = await deleteSessionQuery
      if (!error) navigate('/sessions')
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
    } finally {
      setDeletingSession(false)
    }
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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-8 py-6 text-center max-w-sm">
          <AlertCircle size={28} className="mx-auto mb-3 text-red-400" />
          <h2 className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Session not found</h2>
          <p className="text-xs text-red-500/70 dark:text-red-400/60 mb-4">This session may have been deleted or the link is invalid.</p>
          <Link to="/sessions" className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors">
            ← Back to Sessions
          </Link>
        </div>
      </div>
    )
  }

  const isCompleted = session.status === 'completed'
  const st = SESSION_STATUS_STYLES[session.status] || SESSION_STATUS_STYLES.draft

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {editingName ? (
              <input
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const newName = editNameValue.trim()
                    if (newName && supabase) {
                      const oldName = session.name
                      setSession({ ...session, name: newName })
                      scopeToTeam(
                        supabase.from('sessions').update({ name: newName }).eq('id', session.id),
                        activeTeamId,
                      ).then(({ error }) => {
                        if (error) setSession((s) => s ? { ...s, name: oldName } : s)
                      })
                    }
                    setEditingName(false)
                  }
                  if (e.key === 'Escape') setEditingName(false)
                }}
                onBlur={() => {
                  const newName = editNameValue.trim()
                  if (newName && supabase) {
                    const oldName = session.name
                    setSession({ ...session, name: newName })
                    scopeToTeam(
                      supabase.from('sessions').update({ name: newName }).eq('id', session.id),
                      activeTeamId,
                    ).then(({ error }) => {
                      if (error) setSession((s) => s ? { ...s, name: oldName } : s)
                    })
                  }
                  setEditingName(false)
                }}
                autoFocus
                className="text-xl font-bold text-slate-900 dark:text-gray-100 bg-transparent border-none outline-none px-0 py-0 w-64"
              />
            ) : (
              <div
                onClick={() => { if (!isCompleted) { setEditNameValue(session.name); setEditingName(true) } }}
                className={`flex items-center gap-2.5 whitespace-nowrap ${!isCompleted ? 'cursor-pointer' : ''}`}
                title={!isCompleted ? 'Click to edit title' : ''}
              >
                <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">{session.name}</h1>
                {!isCompleted && <Pencil size={13} className="text-slate-400 dark:text-gray-600" />}
              </div>
            )}
            <button
              onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(''); setDeletingSession(false) }}
              className="text-slate-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Delete session"
            >
              <Trash2 size={15} />
            </button>
            <div className="relative">
              <button
                onClick={() => !isCompleted && setShowStatusMenu(!showStatusMenu)}
                disabled={isCompleted}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${st.bg} ${st.text} ${isCompleted ? 'cursor-default' : 'cursor-pointer hover:opacity-80'} transition-opacity`}
              >
                {session.status}
                {!isCompleted && <ChevronDown size={10} />}
              </button>
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 min-w-[120px]">
                    {(['draft', 'active', 'completed'] as const).map(s => {
                      const sty = SESSION_STATUS_STYLES[s]
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          className={`w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                            session.status === s
                              ? `${sty.bg} ${sty.text}`
                              : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 mb-0.5">
            {teamName && <span className="font-semibold text-blue-600 dark:text-blue-400">{teamName}</span>}
            {teamName && productName && <span>·</span>}
            {productName && (
              <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <Package size={11} />
                {productName}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {session.date && <>{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · </>}
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
            {!isCompleted && (
              <button
                onClick={() => setShowAddScenario(true)}
                className="flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors cursor-pointer"
              >
                <Plus size={12} /> Add
              </button>
            )}
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
                <button
                  onClick={() => { if (!addingScenario) setShowAddScenario(false) }}
                  disabled={addingScenario}
                  className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={addScenario}
                  disabled={!newLetter.trim() || !newTitle.trim() || addingScenario}
                  className="rounded-md bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:bg-slate-400 cursor-pointer disabled:cursor-default"
                >
                  {addingScenario ? 'Adding...' : 'Add'}
                </button>
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
                  onClick={() => {
                    if (isCompleted) {
                      setExpandedScenarioId(expandedScenarioId === scenario.id ? null : scenario.id)
                    } else {
                      setSelectedScenarioId(isSelected ? null : scenario.id)
                    }
                  }}
                  className={`rounded-lg border bg-white dark:bg-gray-900 p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500/30'
                      : expandedScenarioId === scenario.id
                      ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                      : 'border-slate-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isCompleted
                      ? <ChevronDown size={14} className={`text-slate-400 dark:text-gray-500 shrink-0 transition-transform ${expandedScenarioId === scenario.id ? 'rotate-180' : ''}`} />
                      : <GripVertical size={14} className="text-slate-300 dark:text-gray-600 shrink-0" />
                    }
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
                    {!isCompleted && (
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
                    )}
                  </div>
                  {expandedScenarioId === scenario.id && scenario.description && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 space-y-1.5">
                      {scenario.description.split('\n').filter(l => l.trim()).map((line, i) => {
                        const trimmed = line.trim()
                        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
                        const isCheck = trimmed.startsWith('✓') || trimmed.startsWith('✔')
                        if (numberedMatch) {
                          return (
                            <div key={i} className="flex gap-2.5 items-start">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">{numberedMatch[1]}</span>
                              <span className="text-[13px] text-slate-700 dark:text-gray-300 leading-relaxed">{numberedMatch[2]}</span>
                            </div>
                          )
                        }
                        if (isCheck) {
                          return (
                            <div key={i} className="flex gap-2 items-start mt-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-3 py-2">
                              <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                              <span className="text-[13px] font-medium text-green-700 dark:text-green-400">{trimmed.replace(/^[✓✔]\s*/, '')}</span>
                            </div>
                          )
                        }
                        return <p key={i} className="text-[13px] text-slate-600 dark:text-gray-400 leading-relaxed">{trimmed}</p>
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Tester Pool */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Tester Pool</h2>
            {!isCompleted && (
              <div className="flex gap-1.5">
                <button
                  onClick={shuffleAssignments}
                  disabled={shufflingAssignments || resettingAssignments}
                  className="flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default"
                >
                  <Shuffle size={12} /> {shufflingAssignments ? 'Shuffling...' : 'Shuffle'}
                </button>
                <button
                  onClick={resetAssignments}
                  disabled={resettingAssignments || shufflingAssignments}
                  className="flex items-center gap-1 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} /> {resettingAssignments ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            )}
          </div>

          {!isCompleted && selectedScenarioId && (
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
              {isCompleted ? 'Session completed — assignments are locked' : selectedScenarioId ? 'Click a name to assign' : 'Click a scenario first, then a tester'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {testers.map(tester => {
                const used = assignedTesterIds.has(tester.id)
                const scenario = selectedScenarioId ? scenarios.find(s => s.id === selectedScenarioId) : null
                const eligible = scenario ? canAssign(scenario, tester) : true

                return (
                  <button
                    key={tester.id}
                    onClick={() => !isCompleted && selectedScenarioId && eligible && !used && assignTester(selectedScenarioId, tester.id)}
                    disabled={isCompleted || !selectedScenarioId || used || !eligible}
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

          {!isCompleted && (
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-[11px] text-slate-500 dark:text-gray-500 space-y-1">
              <p><Lock size={10} className="inline text-amber-500" /> = device-locked (only matching testers)</p>
              <p><span className="line-through">Name</span> = already assigned</p>
              <p><span className="text-red-400">Name</span> = missing required device</p>
            </div>
          )}

          {isCompleted && (
            <div className="mt-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                <MessageSquareHeart size={14} /> Session Feedback
              </h2>
              <FeedbackModal sessionId={session.id} sessionName={session.name} onClose={() => {}} inline />
            </div>
          )}
        </div>
      </div>
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCompleteConfirm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-2">Complete session?</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-5 leading-relaxed">
              This will lock the session. You will no longer be able to edit scenarios, reassign testers, or change the status. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCompleteConfirm(false)}
                className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                Cancel
              </button>
              <button onClick={confirmComplete}
                className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 cursor-pointer transition-colors">
                Yes, complete session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { if (!deletingSession) { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeletingSession(false) } }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">Delete session?</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3 leading-relaxed">
              This will permanently delete this session and all its scenarios, assignments, and feedback. This action cannot be undone.
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
              Type <span className="font-mono font-bold text-red-500">{session.name}</span> to confirm:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={session.name}
              autoFocus
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-red-400 dark:focus:border-red-500 mb-4 font-mono"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { if (!deletingSession) { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeletingSession(false) } }}
                disabled={deletingSession}
                className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteSession}
                disabled={deleteConfirmText !== session.name || deletingSession}
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-gray-700 disabled:text-slate-500 dark:disabled:text-gray-500 cursor-pointer disabled:cursor-default transition-colors"
              >
                {deletingSession ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
