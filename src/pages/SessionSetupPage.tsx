import React from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Lock, Shuffle, RotateCcw, Presentation, Pencil, MessageSquareHeart, AlertCircle, Package, Play, Pause, Square, Copy, GripVertical } from 'lucide-react'
import SessionSummaryBanner from '../components/SessionSummaryBanner'
import FeedbackModal from '../components/FeedbackModal'
import StatusMenu from '../components/StatusMenu'
import ConfirmModal from '../components/ConfirmModal'
import ScenarioCard from '../components/ScenarioCard'
import ScenarioForm from '../components/ScenarioForm'
import CopyScenariosModal from '../components/CopyScenariosModal'
import { SessionSetupSkeleton } from '../components/Skeleton'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam, withTeamPayload } from '../lib/teamScope'
import { useSessionTimer } from '../lib/sessionTimer'
import { useNotificationStore } from '../stores/notificationStore'
import type { Tester, Scenario, Assignment, Session, SessionStatus } from '../types'

export default function SessionSetupPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const { activeTeamId } = useTeamAccess()
  const [session, setSession] = React.useState<Session | null>(null)
  const [scenarios, setScenarios] = React.useState<Scenario[]>([])
  const [testers, setTesters] = React.useState<Tester[]>([])
  const [assignments, setAssignments] = React.useState<Assignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<string | null>(null)
  const [expandedScenarioId, setExpandedScenarioId] = React.useState<string | null>(null)
  const [showCompleteConfirm, setShowCompleteConfirm] = React.useState(false)
  const [showStatusMenu, setShowStatusMenu] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('')
  const [deletingSession, setDeletingSession] = React.useState(false)
  const [editingName, setEditingName] = React.useState(false)
  const [editNameValue, setEditNameValue] = React.useState('')
  const [teamName, setTeamName] = React.useState<string | null>(null)
  const [productName, setProductName] = React.useState<string | null>(null)
  const [sessionBugCount, setSessionBugCount] = React.useState(0)
  const navigate = useNavigate()
  const { timer, elapsed, startTimer, pauseTimer, resumeTimer, stopTimer } = useSessionTimer()
  const isTimerForThis = timer?.sessionId === sessionId
  const [timerError, setTimerError] = React.useState<string | null>(null)

  // Add/edit scenario state
  const [showAddScenario, setShowAddScenario] = React.useState(false)
  const [showCopyScenarios, setShowCopyScenarios] = React.useState(false)
  const [addingScenario, setAddingScenario] = React.useState(false)
  const [shufflingAssignments, setShufflingAssignments] = React.useState(false)
  const [resettingAssignments, setResettingAssignments] = React.useState(false)
  const [newLetter, setNewLetter] = React.useState('')
  const [newTitle, setNewTitle] = React.useState('')
  const [newDesc, setNewDesc] = React.useState('')
  const [newDevice, setNewDevice] = React.useState('')

  const [dragOverScenarioId, setDragOverScenarioId] = React.useState<string | null>(null)

  const [editScenarioId, setEditScenarioId] = React.useState<string | null>(null)
  const [editLetter, setEditLetter] = React.useState('')
  const [editTitle, setEditTitle] = React.useState('')
  const [editDesc, setEditDesc] = React.useState('')
  const [editDevice, setEditDevice] = React.useState('')
  const [reloadCounter, setReloadCounter] = React.useState(0)

  React.useEffect(() => {
    const load = async () => {
      if (!supabase || !sessionId) return
      const [sessRes, scenRes, testRes, assignRes] = await Promise.all([
        scopeToTeam(supabase.from('sessions').select('*').eq('id', sessionId).single(), activeTeamId),
        scopeToTeam(supabase.from('scenarios').select('*').eq('session_id', sessionId).order('sort_order'), activeTeamId),
        scopeToTeam(supabase.from('testers').select('*').eq('active', true).order('name'), activeTeamId),
        scopeToTeam(supabase.from('assignments').select('*').eq('session_id', sessionId), activeTeamId),
      ])
      if (sessRes.data) {
        setSession(sessRes.data as Session)
        const sess = sessRes.data as Session
        if (sess.team_id) {
          supabase.from('teams').select('name').eq('id', sess.team_id).single().then(({ data: t }) => {
            if (t) setTeamName((t as { name: string }).name)
          })
        }
        if (sess.product_id) {
          supabase.from('products').select('name').eq('id', sess.product_id).single().then(({ data: p }) => {
            if (p) setProductName((p as { name: string }).name)
          })
        }
      }
      setScenarios((scenRes.data || []) as Scenario[])
      const assigns = (assignRes.data || []) as Assignment[]
      setAssignments(assigns)

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

      const sess = sessRes.data as Session | null
      if (sess?.date) {
        const dayStart = sess.date
        const dayEnd = new Date(new Date(sess.date).getTime() + 86400000).toISOString().split('T')[0]
        const { count } = await scopeToTeam(
          supabase.from('bugs').select('*', { count: 'exact', head: true }).gte('created_at', dayStart).lt('created_at', dayEnd),
          activeTeamId,
        )
        setSessionBugCount(count ?? 0)
      } else {
        const { count } = await scopeToTeam(
          supabase.from('bugs').select('*', { count: 'exact', head: true }).eq('session_id', sessionId),
          activeTeamId,
        )
        setSessionBugCount(count ?? 0)
      }

      setLoading(false)
    }

    void load()
  }, [sessionId, activeTeamId, reloadCounter])

  // Reload when AI assistant modifies session data
  React.useEffect(() => {
    return useNotificationStore.subscribe(
      (s) => s.sessionDataChanged.version,
      () => {
        const { sessionId: changedId } = useNotificationStore.getState().sessionDataChanged
        if (!changedId || changedId === sessionId) {
          setReloadCounter((prev) => prev + 1)
        }
      },
    )
  }, [sessionId])

  // Navigate away if this session is deleted via AI
  React.useEffect(() => {
    return useNotificationStore.subscribe(
      (s) => s.sessionDeleted.version,
      () => {
        const { sessionId: deletedId } = useNotificationStore.getState().sessionDeleted
        if (deletedId === sessionId) navigate('/sessions')
      },
    )
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
      // Bulk delete existing non-locked assignments
      const toDeleteIds = assignments.filter(a => !lockedScenarioIds.has(a.scenario_id)).map(a => a.id)
      if (toDeleteIds.length) {
        await scopeToTeam(supabase.from('assignments').delete().in('id', toDeleteIds), activeTeamId)
      }

      // Bulk insert new assignments
      const newAssignments: Assignment[] = [...lockedAssignments]
      const insertPayloads = unlockedScenarios.slice(0, shuffled.length).map((sc, i) =>
        withTeamPayload({ session_id: sessionId, scenario_id: sc.id, tester_id: shuffled[i].id }, activeTeamId),
      )
      if (insertPayloads.length) {
        const { data } = await supabase.from('assignments').insert(insertPayloads).select()
        if (data) newAssignments.push(...(data as Assignment[]))
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

  const copyScenarios = async (items: Pick<Scenario, 'letter' | 'title' | 'description' | 'device_requirement'>[]) => {
    if (!supabase || !sessionId || !items.length) return
    const maxOrder = scenarios.length ? Math.max(...scenarios.map(s => s.sort_order)) : 0
    const rows = items.map((item, i) => withTeamPayload({
      session_id: sessionId,
      letter: item.letter,
      title: item.title,
      description: item.description || null,
      device_requirement: item.device_requirement || null,
      sort_order: maxOrder + 1 + i,
    }, activeTeamId))
    const { data, error } = await supabase.from('scenarios').insert(rows).select()
    if (!error && data) {
      setScenarios(prev => [...prev, ...(data as Scenario[])])
    }
    setShowCopyScenarios(false)
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

  const handleDrop = (scenarioId: string, event: React.DragEvent) => {
    event.preventDefault()
    setDragOverScenarioId(null)

    const draggedScenarioId = event.dataTransfer.getData('text/scenario-id')
    if (draggedScenarioId) {
      if (draggedScenarioId !== scenarioId) {
        const fromIdx = scenarios.findIndex(s => s.id === draggedScenarioId)
        const toIdx = scenarios.findIndex(s => s.id === scenarioId)
        if (fromIdx >= 0 && toIdx >= 0) {
          const reordered = [...scenarios]
          const [moved] = reordered.splice(fromIdx, 1)
          reordered.splice(toIdx, 0, moved)
          const updated = reordered.map((s, i) => ({ ...s, sort_order: i + 1 }))
          setScenarios(updated)
          if (supabase) {
            const sb = supabase
            Promise.all(
              updated.map(s =>
                scopeToTeam(sb.from('scenarios').update({ sort_order: s.sort_order }).eq('id', s.id), activeTeamId)
              )
            )
          }
        }
      }
      return
    }

    const testerId = event.dataTransfer.getData('text/tester-id')
    if (!testerId) return
    const tester = testers.find(t => t.id === testerId)
    const scenario = scenarios.find(s => s.id === scenarioId)
    if (!tester || !scenario) return
    if (assignedTesterIds.has(testerId)) return
    if (!canAssign(scenario, tester)) return
    assignTester(scenarioId, testerId)
  }

  const handleDragOver = (scenarioId: string, event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverScenarioId !== scenarioId) setDragOverScenarioId(scenarioId)
  }

  if (loading) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-6">
        <SessionSetupSkeleton />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-8 py-6 text-center max-w-sm">
          <AlertCircle size={28} className="mx-auto mb-3 text-red-400" />
          <h2 className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Session not found</h2>
          <p className="text-xs text-red-500/70 dark:text-red-400/60 mb-4">This session may have been deleted or the link is invalid.</p>
          <Link to="/sessions" className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-on-danger hover:bg-red-600 transition-colors">
            ← Back to Sessions
          </Link>
        </div>
      </div>
    )
  }

  const isCompleted = session.status === 'completed'

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {editingName ? (
              <input
                value={editNameValue}
                onChange={event => setEditNameValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
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
                  if (event.key === 'Escape') setEditingName(false)
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
                onClick={() => { setEditNameValue(session.name); setEditingName(true) }}
                className="flex items-center gap-2.5 whitespace-nowrap cursor-pointer"
                title="Click to edit title"
              >
                <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">{session.name}</h1>
                <Pencil size={13} className="text-slate-400 dark:text-gray-600" />
              </div>
            )}
            <StatusMenu
              currentStatus={session.status}
              open={showStatusMenu}
              onToggle={() => setShowStatusMenu(!showStatusMenu)}
              onSelect={setStatus}
              onClose={() => setShowStatusMenu(false)}
              disabled={false}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 mt-1.5">
            {teamName && <span className="inline-flex items-center rounded-full border border-slate-300 dark:border-gray-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400">Team: {teamName}</span>}
            {teamName && productName && <span>·</span>}
            {productName && (
              <span className="flex items-center gap-1 font-medium text-violet-600 dark:text-mushi-tertiary">
                <Package size={11} />
                {productName}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
            {session.date && <>{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · </>}
            {scenarios.length} scenarios · {assignments.length} assigned · {testers.length} testers in pool
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && (
            isTimerForThis && timer ? (
              <div className="flex items-center gap-1.5">
                {timer.status === 'running' ? (
                  <button
                    onClick={pauseTimer}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <Pause size={14} /> Pause
                  </button>
                ) : (
                  <button
                    onClick={resumeTimer}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                  >
                    <Play size={14} /> Resume
                  </button>
                )}
                <button
                  onClick={async () => {
                    const r = await stopTimer()
                    if (r.error) { setTimerError(r.error) }
                    else { setTimerError(null); setReloadCounter((prev) => prev + 1) }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                >
                  <Square size={12} fill="currentColor" /> Stop
                </button>
              </div>
            ) : (
              <button
                onClick={() => session && startTimer(session.id, session.name)}
                disabled={!!timer}
                className="flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
                title={timer ? `Timer already running for ${timer.sessionName}` : 'Start session timer'}
              >
                <Play size={14} /> Start Timer
              </button>
            )
          )}
          <Link
            to={`/sessions/${sessionId}/present`}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors"
          >
            <Presentation size={16} /> Present
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-slate-500 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {timerError && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 mb-4">
          <span className="text-xs font-medium text-red-700 dark:text-red-400">{timerError}</span>
          <button onClick={() => setTimerError(null)} className="text-xs font-bold text-red-500 hover:text-red-700 dark:hover:text-red-300 cursor-pointer">Dismiss</button>
        </div>
      )}

      {(session.status === 'active' || isCompleted) && (
        <SessionSummaryBanner
          assignedCount={assignments.length}
          totalTesters={testers.length}
          assignedScenarios={new Set(assignments.map(a => a.scenario_id)).size}
          totalScenarios={scenarios.length}
          isCompleted={isCompleted}
          bugCount={sessionBugCount}
          durationSeconds={session.duration_seconds ?? null}
          timerElapsed={isTimerForThis ? elapsed : null}
          onDurationChange={async (seconds) => {
            if (!supabase) return
            setSession(s => s ? { ...s, duration_seconds: seconds } : s)
            await scopeToTeam(
              supabase.from('sessions').update({ duration_seconds: seconds }).eq('id', session.id),
              activeTeamId,
            )
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scenarios */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Scenarios</h2>
            {!isCompleted && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowCopyScenarios(true)}
                  className="flex items-center gap-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <Copy size={12} /> Copy from...
                </button>
                <button
                  onClick={() => setShowAddScenario(true)}
                  className="flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            )}
          </div>

          {showAddScenario && (
            <ScenarioForm
              mode="add"
              letter={newLetter}
              title={newTitle}
              description={newDesc}
              device={newDevice}
              onLetterChange={setNewLetter}
              onTitleChange={setNewTitle}
              onDescriptionChange={setNewDesc}
              onDeviceChange={setNewDevice}
              onSave={addScenario}
              onCancel={() => { if (!addingScenario) setShowAddScenario(false) }}
              saveDisabled={!newLetter.trim() || !newTitle.trim()}
              saving={addingScenario}
            />
          )}

          <div className="space-y-1.5">
            {scenarios.map((scenario, idx) => {
              const assigned = getAssignedTester(scenario.id)
              const locked = isDeviceLocked(scenario)
              const isSelected = selectedScenarioId === scenario.id
              const isEditing = editScenarioId === scenario.id

              if (isEditing) {
                return (
                  <ScenarioForm
                    key={scenario.id}
                    mode="edit"
                    letter={editLetter}
                    title={editTitle}
                    description={editDesc}
                    device={editDevice}
                    onLetterChange={setEditLetter}
                    onTitleChange={setEditTitle}
                    onDescriptionChange={setEditDesc}
                    onDeviceChange={setEditDevice}
                    onSave={saveEditScenario}
                    onCancel={() => setEditScenarioId(null)}
                  />
                )
              }

              return (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  index={idx}
                  totalCount={scenarios.length}
                  assigned={assigned}
                  isSelected={isSelected}
                  isExpanded={expandedScenarioId === scenario.id}
                  isCompleted={isCompleted}
                  isDeviceLocked={locked}
                  isDragOver={dragOverScenarioId === scenario.id}
                  draggable={!isCompleted}
                  onClick={() => {
                    if (isCompleted) {
                      setExpandedScenarioId(expandedScenarioId === scenario.id ? null : scenario.id)
                    } else {
                      setSelectedScenarioId(isSelected ? null : scenario.id)
                    }
                  }}
                  onMoveUp={() => moveScenario(scenario.id, 'up')}
                  onMoveDown={() => moveScenario(scenario.id, 'down')}
                  onEdit={() => startEditScenario(scenario)}
                  onDelete={() => deleteScenario(scenario.id)}
                  onDrop={!isCompleted ? (event) => handleDrop(scenario.id, event) : undefined}
                  onDragOver={!isCompleted ? (event) => handleDragOver(scenario.id, event) : undefined}
                  onDragLeave={!isCompleted ? () => setDragOverScenarioId(null) : undefined}
                  onDragStart={!isCompleted ? (event) => {
                    event.dataTransfer.setData('text/scenario-id', scenario.id)
                    event.dataTransfer.effectAllowed = 'move'
                  } : undefined}
                />
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
                  className="flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default"
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
                  className="mb-2 rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-on-danger hover:bg-red-600 cursor-pointer">
                  Unassign {getAssignedTester(selectedScenarioId)?.name}
                </button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <p className="text-xs text-slate-500 dark:text-gray-500 mb-2">
              {isCompleted ? 'Session completed — assignments are locked' : selectedScenarioId ? 'Click a name to assign' : 'Click a scenario first, then a tester — or drag a name onto a scenario'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {testers.map(tester => {
                const used = assignedTesterIds.has(tester.id)
                const scenario = selectedScenarioId ? scenarios.find(s => s.id === selectedScenarioId) : null
                const eligible = scenario ? canAssign(scenario, tester) : true

                return (
                  <button
                    key={tester.id}
                    draggable={!isCompleted && !used}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/tester-id', tester.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => !isCompleted && selectedScenarioId && eligible && !used && assignTester(selectedScenarioId, tester.id)}
                    disabled={isCompleted || !selectedScenarioId || used || !eligible}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-all select-none ${
                      used
                        ? 'opacity-60 line-through border-slate-300 dark:border-gray-600 text-slate-500 dark:text-gray-400 cursor-default'
                        : !eligible
                        ? 'opacity-40 border-red-200 dark:border-red-800 text-red-400 dark:text-red-600 cursor-not-allowed'
                        : selectedScenarioId
                        ? 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'
                        : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 cursor-grab active:cursor-grabbing'
                    }`}
                    title={!eligible ? `Missing device: ${scenario?.device_requirement}` : !isCompleted && !used ? 'Drag to a scenario to assign' : ''}
                  >
                    {!isCompleted && !used && <GripVertical size={10} className="shrink-0 opacity-40" />}
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
        <ConfirmModal
          title="Complete session?"
          confirmLabel="Yes, complete session"
          onConfirm={confirmComplete}
          onCancel={() => setShowCompleteConfirm(false)}
        >
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-5 leading-relaxed">
            This will lock the session. You will no longer be able to edit scenarios, reassign testers, or change the status. This action cannot be undone.
          </p>
        </ConfirmModal>
      )}

      {showDeleteConfirm && session && (
        <ConfirmModal
          title="Delete session?"
          titleClassName="text-sm font-bold text-red-600 dark:text-red-400 mb-2"
          confirmLabel="Delete permanently"
          confirmClassName="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-on-danger hover:bg-red-600 cursor-pointer transition-colors"
          onConfirm={deleteSession}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeletingSession(false) }}
          disabled={deleteConfirmText !== session.name}
          loading={deletingSession}
        >
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-3 leading-relaxed">
            This will permanently delete this session and all its scenarios, assignments, and feedback. This action cannot be undone.
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
            Type <span className="font-mono font-bold text-red-500">{session.name}</span> to confirm:
          </p>
          <input
            value={deleteConfirmText}
            onChange={event => setDeleteConfirmText(event.target.value)}
            placeholder={session.name}
            autoFocus
            className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-red-400 dark:focus:border-red-500 mb-4 font-mono"
          />
        </ConfirmModal>
      )}

      {showCopyScenarios && sessionId && (
        <CopyScenariosModal
          currentSessionId={sessionId}
          activeTeamId={activeTeamId}
          onCopy={copyScenarios}
          onClose={() => setShowCopyScenarios(false)}
        />
      )}
    </div>
  )
}
