import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Calendar, Users, FileText, Presentation } from 'lucide-react'
import { supabase } from '../supabaseClient'

interface Session {
  id: string
  name: string
  date: string | null
  status: 'draft' | 'active' | 'completed'
  created_at: string
  scenario_count?: number
  assignment_count?: number
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100 dark:bg-gray-800', text: 'text-slate-600 dark:text-gray-400' },
  active: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-400' },
  completed: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400' },
}

export default function SessionsListPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (sessionsData) {
      const enriched: Session[] = []
      for (const s of sessionsData) {
        const { count: scCount } = await supabase
          .from('scenarios')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id)
        const { count: asCount } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id)
        enriched.push({ ...s, scenario_count: scCount ?? 0, assignment_count: asCount ?? 0 } as Session)
      }
      setSessions(enriched)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createSession = async () => {
    if (!supabase || !newName.trim()) return
    const { data, error } = await supabase
      .from('sessions')
      .insert({ name: newName.trim(), date: newDate || null, status: 'draft' })
      .select()
    if (!error && data?.[0]) {
      setSessions(prev => [{ ...data[0], scenario_count: 0, assignment_count: 0 } as Session, ...prev])
      setNewName('')
      setNewDate('')
      setShowCreate(false)
    }
  }

  const cycleStatus = async (session: Session) => {
    if (!supabase) return
    const next = session.status === 'draft' ? 'active' : session.status === 'active' ? 'completed' : 'draft'
    const { error } = await supabase.from('sessions').update({ status: next }).eq('id', session.id)
    if (!error) setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: next as Session['status'] } : s))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Loading sessions...</div>
  }

  return (
    <div className="max-w-screen-lg mx-auto px-7 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Testing Sessions</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer"
        >
          <Plus size={16} /> New Session
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3">Create Session</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Session name *"
              autoFocus
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            />
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); setNewName(''); setNewDate('') }}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <button onClick={createSession} disabled={!newName.trim()}
              className="rounded-md px-5 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default">
              Create
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-gray-600">
          <Presentation size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No sessions yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => {
            const st = STATUS_STYLES[session.status]
            return (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="block rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 truncate">{session.name}</h3>
                      <button
                        onClick={e => { e.preventDefault(); cycleStatus(session) }}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${st.bg} ${st.text} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        {session.status}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-gray-500">
                      {session.date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {session.scenario_count} scenario{session.scenario_count !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {session.assignment_count} assigned
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
