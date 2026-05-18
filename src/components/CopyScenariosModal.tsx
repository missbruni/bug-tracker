import { useState, useEffect } from 'react'
import { X, Check, ChevronRight, FileText } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { scopeToTeam } from '../lib/teamScope'
import type { Scenario } from '../types'

interface SessionOption {
  id: string
  name: string
  date: string | null
  status: string
}

interface CopyScenariosModalProps {
  currentSessionId: string
  activeTeamId: string | null
  onCopy: (scenarios: Pick<Scenario, 'letter' | 'title' | 'description' | 'device_requirement'>[]) => void
  onClose: () => void
}

export default function CopyScenariosModal({ currentSessionId, activeTeamId, onCopy, onClose }: CopyScenariosModalProps) {
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loadingScenarios, setLoadingScenarios] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState(false)

  // Load other sessions
  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const { data } = await scopeToTeam(
        supabase.from('sessions').select('id, name, date, status').neq('id', currentSessionId).order('created_at', { ascending: false }),
        activeTeamId,
      )
      setSessions((data || []) as SessionOption[])
      setLoading(false)
    })()
  }, [currentSessionId, activeTeamId])

  // Load scenarios when a session is selected
  useEffect(() => {
    if (!supabase || !selectedSessionId) {
      setScenarios([])
      setSelected(new Set())
      return
    }
    setLoadingScenarios(true)
    ;(async () => {
      const { data } = await scopeToTeam(
        supabase.from('scenarios').select('*').eq('session_id', selectedSessionId).order('sort_order'),
        activeTeamId,
      )
      const items = (data || []) as Scenario[]
      setScenarios(items)
      setSelected(new Set(items.map(s => s.id)))
      setLoadingScenarios(false)
    })()
  }, [selectedSessionId, activeTeamId])

  const toggleAll = () => {
    if (selected.size === scenarios.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(scenarios.map(s => s.id)))
    }
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopy = () => {
    if (selected.size === 0) return
    setCopying(true)
    const toCopy = scenarios
      .filter(s => selected.has(s.id))
      .map(s => ({ letter: s.letter, title: s.title, description: s.description, device_requirement: s.device_requirement }))
    onCopy(toCopy)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Copy Scenarios from Session</h2>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {!selectedSessionId ? (
            // Step 1: Pick a session
            <>
              <p className="text-xs text-slate-500 dark:text-gray-500 mb-3">Select a session to copy scenarios from:</p>
              {loading ? (
                <div className="text-xs text-slate-400 dark:text-gray-600 py-8 text-center">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-gray-600 py-8 text-center">No other sessions found.</div>
              ) : (
                <div className="space-y-1">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      className="w-full flex items-center justify-between rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2.5 text-left hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-900 dark:text-gray-100 block truncate">{s.name}</span>
                        {s.date && (
                          <span className="text-[10px] text-slate-400 dark:text-gray-500">
                            {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-slate-300 dark:text-gray-600 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Step 2: Pick scenarios
            <>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="text-xs text-blue-500 hover:text-blue-600 font-semibold mb-3 cursor-pointer"
              >
                ← Back to sessions
              </button>
              {loadingScenarios ? (
                <div className="text-xs text-slate-400 dark:text-gray-600 py-8 text-center">Loading scenarios...</div>
              ) : scenarios.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-gray-600 py-8 text-center">This session has no scenarios.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500 dark:text-gray-500">
                      {selected.size} of {scenarios.length} selected
                    </p>
                    <button onClick={toggleAll} className="text-[10px] font-semibold text-blue-500 hover:text-blue-600 cursor-pointer">
                      {selected.size === scenarios.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {scenarios.map(s => {
                      const isSelected = selected.has(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggle(s.id)}
                          className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-slate-300 dark:border-gray-600'
                          }`}>
                            {isSelected && <Check size={12} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-blue-500 dark:text-blue-400">{s.letter}</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">{s.title}</span>
                            </div>
                            {s.description && (
                              <p className="text-[10px] text-slate-400 dark:text-gray-500 truncate mt-0.5">{s.description}</p>
                            )}
                          </div>
                          {s.device_requirement && (
                            <span className="text-[10px] text-slate-400 dark:text-gray-500 shrink-0">{s.device_requirement}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {selectedSessionId && scenarios.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              disabled={selected.size === 0 || copying}
              className="flex items-center gap-1.5 rounded-md bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
            >
              <FileText size={12} />
              {copying ? 'Copying...' : `Copy ${selected.size} scenario${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
