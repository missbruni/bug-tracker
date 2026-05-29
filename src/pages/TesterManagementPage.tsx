import React from 'react'
import { Plus, Trash2, Pencil, X, Check, CheckCircle, XCircle } from 'lucide-react'
import InlineDeleteConfirm from '../components/InlineDeleteConfirm'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam, withTeamPayload } from '../lib/teamScope'
import { COMMON_TESTER_DEVICES } from '../lib/testerDevices'
import SecondaryAppBar from '../components/SecondaryAppBar'
import { TesterListSkeleton } from '../components/Skeleton'
import type { Tester } from '../lib/testerLookup'

async function fetchTesters(activeTeamId: string | null): Promise<Tester[]> {
  if (!supabase) return []
  const { data } = await scopeToTeam(
    supabase.from('testers').select('*').order('name'),
    activeTeamId,
  )
  return (data || []) as Tester[]
}

export default function TesterManagementPage() {
  const queryClient = useQueryClient()
  const { activeTeamId, activeTeam, teams, isGodMode, setActiveTeamId } = useTeamAccess()
  const testersQueryKey = ['testers', activeTeamId] as const
  const { data: testers = [], isLoading: loading } = useQuery({
    queryKey: testersQueryKey,
    queryFn: () => fetchTesters(activeTeamId),
  })
  const [showAdd, setShowAdd] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [newDevices, setNewDevices] = React.useState<string[]>([])
  const [addingTester, setAddingTester] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editDevices, setEditDevices] = React.useState<string[]>([])
  const [pendingDeleteTesterId, setPendingDeleteTesterId] = React.useState<string | null>(null)
  const [deletingTesterId, setDeletingTesterId] = React.useState<string | null>(null)
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const addTester = async () => {
    if (!supabase || !newName.trim() || addingTester) return
    setAddingTester(true)
    try {
      const { data, error } = await supabase
        .from('testers')
        .insert(withTeamPayload({ name: newName.trim(), devices: newDevices, active: true }, activeTeamId))
        .select()
      if (!error && data?.[0]) {
        queryClient.setQueryData(testersQueryKey, (prev: Tester[]) => [...prev, data[0] as Tester].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName('')
        setNewDevices([])
        setShowAdd(false)
      }
    } finally {
      setAddingTester(false)
    }
  }

  const toggleActive = async (tester: Tester) => {
    if (!supabase) return
    const toggleQuery = scopeToTeam(
      supabase.from('testers').update({ active: !tester.active }).eq('id', tester.id),
      activeTeamId,
    )
    const { error } = await toggleQuery
    if (!error) {
      queryClient.setQueryData(testersQueryKey, (prev: Tester[]) =>
        prev.map(existingTester => existingTester.id === tester.id ? { ...existingTester, active: !existingTester.active } : existingTester),
      )
    }
  }

  const confirmDeleteTester = async (tester: Tester) => {
    if (!supabase) {
      setPendingDeleteTesterId(null)
      return
    }
    if (deletingTesterId) return
    setDeletingTesterId(tester.id)

    const { count: assignmentCount, error: assignmentErr } = await scopeToTeam(
      supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tester_id', tester.id),
      activeTeamId,
    )

    if (assignmentErr) {
      setToast({ message: `Failed to verify assignments: ${assignmentErr.message}`, tone: 'error' })
      setDeletingTesterId(null)
      setPendingDeleteTesterId(null)
      return
    }

    let bugCount = 0
    const bugByIdRes = await scopeToTeam(
      supabase
        .from('bugs')
        .select('*', { count: 'exact', head: true })
        .eq('tester_id', tester.id),
      activeTeamId,
    )

    if (bugByIdRes.error) {
      if (!bugByIdRes.error.message.toLowerCase().includes('tester_id')) {
        setToast({ message: `Failed to verify bug dependencies: ${bugByIdRes.error.message}`, tone: 'error' })
        setDeletingTesterId(null)
        setPendingDeleteTesterId(null)
        return
      }

      const scopedLegacyBugRes = await scopeToTeam(
        supabase
          .from('bugs')
          .select('*', { count: 'exact', head: true })
          .ilike('tester', tester.name),
        activeTeamId,
      )

      if (scopedLegacyBugRes.error) {
        setToast({ message: `Failed to verify bug dependencies: ${scopedLegacyBugRes.error.message}`, tone: 'error' })
        setDeletingTesterId(null)
        setPendingDeleteTesterId(null)
        return
      }

      bugCount = scopedLegacyBugRes.count || 0
    } else {
      bugCount = bugByIdRes.count || 0
    }

    if ((assignmentCount || 0) > 0 || bugCount > 0) {
      const reasons: string[] = []
      if ((assignmentCount || 0) > 0) reasons.push(`${assignmentCount} assignment(s)`)
      if (bugCount > 0) reasons.push(`${bugCount} bug(s)`)
      setToast({ message: `Can't delete ${tester.name} — linked to ${reasons.join(' and ')}. Deactivate instead.`, tone: 'error' })
      setDeletingTesterId(null)
      setPendingDeleteTesterId(null)
      return
    }

    const deleteQuery = scopeToTeam(
      supabase.from('testers').delete().eq('id', tester.id),
      activeTeamId,
    )
    const { error } = await deleteQuery
    if (error) {
      setToast({ message: `Failed to delete tester: ${error.message}`, tone: 'error' })
      setDeletingTesterId(null)
      setPendingDeleteTesterId(null)
      return
    }
    queryClient.setQueryData(testersQueryKey, (prev: Tester[]) => prev.filter(existingTester => existingTester.id !== tester.id))
    setDeletingTesterId(null)
    setPendingDeleteTesterId(null)
    setToast({ message: `${tester.name} deleted.`, tone: 'success' })
  }

  const startEdit = (tester: Tester) => {
    setEditingId(tester.id)
    setEditName(tester.name)
    setEditDevices([...tester.devices])
  }

  const saveEdit = async () => {
    if (!supabase || !editingId || !editName.trim()) return
    const saveQuery = scopeToTeam(
      supabase
        .from('testers')
        .update({ name: editName.trim(), devices: editDevices })
        .eq('id', editingId),
      activeTeamId,
    )
    const { error } = await saveQuery
    if (!error) {
      queryClient.setQueryData(testersQueryKey, (prev: Tester[]) =>
        prev.map(existingTester => existingTester.id === editingId ? { ...existingTester, name: editName.trim(), devices: editDevices } : existingTester)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
    }
  }

  const toggleDevice = (device: string, list: string[], setDeviceList: (devices: string[]) => void) => {
    setDeviceList(list.includes(device) ? list.filter(existingDevice => existingDevice !== device) : [...list, device])
  }

  return (
    <>
      <SecondaryAppBar
        description=""
        stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{testers.filter(tester => tester.active).length} active</span> / {testers.length} total</>}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search testers, devices..."
        actionButton={
          <button
            onClick={() => setShowAdd(true)}
            className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            Add Tester
          </button>
        }
      />

      <div className="max-w-screen-lg mx-auto px-4 sm:px-7 py-6">

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase tracking-tight">Testers</h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Manage your QA squad roster and device assignments.</p>
      </div>

      {loading ? (
        <TesterListSkeleton />
      ) : (<>
      {showAdd && (
        <div className="mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3">New Tester</h2>
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1 block">Team</label>
            {isGodMode && teams.length > 1 ? (
              <select
                value={activeTeamId || ''}
                onChange={event => setActiveTeamId(event.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                {activeTeam?.name || 'No team selected'}
              </span>
            )}
            {!activeTeamId && (
              <p className="text-xs text-red-500 mt-1">No active team — tester cannot be created without a team.</p>
            )}
          </div>
          <input
            value={newName}
            onChange={event => setNewName(event.target.value)}
            placeholder="Tester name"
            autoFocus
            className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 mb-3"
          />
          <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">Devices:</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {COMMON_TESTER_DEVICES.map(deviceName => (
              <button
                key={deviceName}
                onClick={() => toggleDevice(deviceName, newDevices, setNewDevices)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                  newDevices.includes(deviceName)
                    ? 'bg-blue-500 text-white dark:text-mushi-bg border-blue-500'
                    : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              >
                {deviceName}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { if (addingTester) return; setShowAdd(false); setNewName(''); setNewDevices([]) }}
              disabled={addingTester}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer">
              Cancel
            </button>
            <button onClick={addTester} disabled={!newName.trim() || addingTester || !activeTeamId}
              className="rounded-md px-5 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default">
              {addingTester ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {testers
          .filter(tester => {
            if (!search.trim()) return true
            const query = search.toLowerCase()
            return tester.name.toLowerCase().includes(query) || tester.devices.some(deviceName => deviceName.toLowerCase().includes(query))
          })
          .map(tester => (
          <div
            key={tester.id}
            className={`rounded-lg border bg-white dark:bg-gray-900 p-4 transition-all ${
              tester.active
                ? 'border-slate-200 dark:border-gray-700'
                : 'border-slate-200 dark:border-gray-800 opacity-50'
            } ${deletingTesterId === tester.id ? 'opacity-50' : ''}`}
          >
            {editingId === tester.id ? (
              <div>
                <input
                  value={editName}
                  onChange={event => setEditName(event.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 mb-3"
                  autoFocus
                />
                <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">Devices:</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {COMMON_TESTER_DEVICES.map(deviceName => (
                    <button
                      key={deviceName}
                      onClick={() => toggleDevice(deviceName, editDevices, setEditDevices)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                        editDevices.includes(deviceName)
                          ? 'bg-blue-500 text-white dark:text-mushi-bg border-blue-500'
                          : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {deviceName}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)}
                    className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 cursor-pointer">
                    <X size={14} />
                  </button>
                  <button onClick={saveEdit}
                    className="rounded-md bg-green-500 px-3 py-1.5 text-xs text-white font-semibold cursor-pointer hover:bg-green-600">
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => toggleActive(tester)}
                  className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                    tester.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    tester.active ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{tester.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tester.devices.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-gray-600 italic">No devices configured</span>
                    ) : (
                      tester.devices.map(deviceName => (
                        <span key={deviceName} className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
                          {deviceName}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <button onClick={() => startEdit(tester)}
                  className="text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer p-1">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (deletingTesterId) return
                    setPendingDeleteTesterId(tester.id)
                  }}
                  disabled={deletingTesterId === tester.id}
                  className="text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer p-1 disabled:opacity-60 disabled:cursor-default"
                >
                  <Trash2 size={14} />
                </button>
                {pendingDeleteTesterId === tester.id && (
                  <InlineDeleteConfirm
                    isDeleting={deletingTesterId === tester.id}
                    onConfirm={() => { void confirmDeleteTester(tester) }}
                    onCancel={() => setPendingDeleteTesterId(null)}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      </>)}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg bg-white dark:bg-mushi-surface border-slate-200 dark:border-gray-700 ${toast.tone === 'success' ? 'text-teal-600 dark:text-mushi-primary' : 'text-red-600 dark:text-red-400'}`}>
          {toast.tone === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
          {toast.message}
        </div>
      )}
      </div>
    </>
  )
}
