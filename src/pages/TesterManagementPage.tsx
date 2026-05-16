import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X, Check, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { COMMON_TESTER_DEVICES } from '../lib/testerDevices'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import SecondaryAppBar from '../components/SecondaryAppBar'
import type { Tester } from '../types'

export default function TesterManagementPage() {
  const [testers, setTesters] = useState<Tester[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDevices, setNewDevices] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDevices, setEditDevices] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Tester | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('testers').select('*').order('name')
    setTesters((data || []) as Tester[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addTester = async () => {
    if (!supabase || !newName.trim()) return
    const { data, error } = await supabase
      .from('testers')
      .insert({ name: newName.trim(), devices: newDevices, active: true })
      .select()
    if (!error && data?.[0]) {
      setTesters(prev => [...prev, data[0] as Tester].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewDevices([])
      setShowAdd(false)
    }
  }

  const toggleActive = async (tester: Tester) => {
    if (!supabase) return
    const { error } = await supabase.from('testers').update({ active: !tester.active }).eq('id', tester.id)
    if (!error) setTesters(prev => prev.map(t => t.id === tester.id ? { ...t, active: !t.active } : t))
  }

  const confirmDeleteTester = async () => {
    if (!supabase || !deleteTarget) return
    const tester = deleteTarget

    const { count: assignmentCount, error: assignmentErr } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tester_id', tester.id)

    if (assignmentErr) {
      setDeleteError(`Failed to verify assignments: ${assignmentErr.message}`)
      return
    }

    let bugCount = 0
    const bugByIdRes = await supabase
      .from('bugs')
      .select('*', { count: 'exact', head: true })
      .eq('tester_id', tester.id)

    if (bugByIdRes.error) {
      if (!bugByIdRes.error.message.toLowerCase().includes('tester_id')) {
        setDeleteError(`Failed to verify bug dependencies: ${bugByIdRes.error.message}`)
        return
      }

      const legacyBugRes = await supabase
        .from('bugs')
        .select('*', { count: 'exact', head: true })
        .ilike('tester', tester.name)

      if (legacyBugRes.error) {
        setDeleteError(`Failed to verify bug dependencies: ${legacyBugRes.error.message}`)
        return
      }

      bugCount = legacyBugRes.count || 0
    } else {
      bugCount = bugByIdRes.count || 0
    }

    if ((assignmentCount || 0) > 0 || bugCount > 0) {
      const reasons: string[] = []
      if ((assignmentCount || 0) > 0) reasons.push(`${assignmentCount} assignment(s)`)
      if (bugCount > 0) reasons.push(`${bugCount} bug(s)`)
      setDeleteError(`Can't delete ${tester.name} — linked to ${reasons.join(' and ')}. Deactivate them instead.`)
      return
    }

    const { error } = await supabase.from('testers').delete().eq('id', tester.id)
    if (error) {
      setDeleteError(`Failed to delete tester: ${error.message}`)
      return
    }
    setTesters(prev => prev.filter(t => t.id !== tester.id))
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const startEdit = (tester: Tester) => {
    setEditingId(tester.id)
    setEditName(tester.name)
    setEditDevices([...tester.devices])
  }

  const saveEdit = async () => {
    if (!supabase || !editingId || !editName.trim()) return
    const { error } = await supabase
      .from('testers')
      .update({ name: editName.trim(), devices: editDevices })
      .eq('id', editingId)
    if (!error) {
      setTesters(prev =>
        prev.map(t => t.id === editingId ? { ...t, name: editName.trim(), devices: editDevices } : t)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
    }
  }

  const toggleDevice = (device: string, list: string[], setter: (d: string[]) => void) => {
    setter(list.includes(device) ? list.filter(d => d !== device) : [...list, device])
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Loading testers...</div>
  }

  return (
    <>
      <SecondaryAppBar
        description="Manage your QA team — add testers, assign devices, and control availability."
        stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{testers.filter(t => t.active).length} active</span> / {testers.length} total</>}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search testers, devices..."
        actionButton={
          <button
            onClick={() => setShowAdd(true)}
            className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            Add Tester
          </button>
        }
      />

      <div className="max-w-screen-lg mx-auto px-7 py-6">

      {showAdd && (
        <div className="mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3">New Tester</h3>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Tester name"
            autoFocus
            className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 mb-3"
          />
          <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">Devices:</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {COMMON_TESTER_DEVICES.map(d => (
              <button
                key={d}
                onClick={() => toggleDevice(d, newDevices, setNewDevices)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                  newDevices.includes(d)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewDevices([]) }}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <button onClick={addTester} disabled={!newName.trim()}
              className="rounded-md px-5 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {testers
          .filter(tester => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return tester.name.toLowerCase().includes(q) || tester.devices.some(d => d.toLowerCase().includes(q))
          })
          .map(tester => (
          <div
            key={tester.id}
            className={`rounded-lg border bg-white dark:bg-gray-900 p-4 transition-all ${
              tester.active
                ? 'border-slate-200 dark:border-gray-700'
                : 'border-slate-200 dark:border-gray-800 opacity-50'
            }`}
          >
            {editingId === tester.id ? (
              <div>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 mb-3"
                  autoFocus
                />
                <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">Devices:</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {COMMON_TESTER_DEVICES.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleDevice(d, editDevices, setEditDevices)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                        editDevices.includes(d)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {d}
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
              <div className="flex items-center gap-3">
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
                      tester.devices.map(d => (
                        <span key={d} className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
                          {d}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <button onClick={() => startEdit(tester)}
                  className="text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer p-1">
                  <Pencil size={14} />
                </button>
                <button onClick={() => { setDeleteTarget(tester); setDeleteError(null) }}
                  className="text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete tester?"
          description={`This will permanently delete "${deleteTarget.name}". This action cannot be undone.`}
          confirmToken={deleteTarget.name}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
          onConfirm={confirmDeleteTester}
          error={deleteError}
        />
      )}
      </div>
    </>
  )
}
