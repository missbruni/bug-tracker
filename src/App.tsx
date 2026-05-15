import { useState, useEffect, useRef } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from './supabaseClient'
import { SEVERITIES, SEVERITY_STYLES } from './constants'
import Lightbox from './components/Lightbox'
import BugCard from './components/BugCard'
import AddBugForm from './components/AddBugForm'
import FilterBar from './components/FilterBar'
import QuestionsSection from './components/QuestionsSection'
import { useBugs } from './hooks/useBugs'
import { useBugFilters } from './hooks/useBugFilters'
import type { LightboxState } from './types'

export default function App() {
  const {
    bugs,
    questions,
    sessions,
    loading,
    snackbar,
    setSnackbar,
    clearSnackbar,
    updateBug,
    deleteBugFromState,
    showPersistError,
    addBug,
    deleteQuestion,
    showAddForm,
    setShowAddForm,
  } = useBugs()

  const filters = useBugFilters(bugs, questions)
  const { search, setSearch, severityFilter, testerFilter, testers, activeBugs, counts, nextIds, grouped, filteredQuestions, isSearchPending } = filters

  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const handler = (e: Event) => setIsDark((e as CustomEvent).detail.dark)
    window.addEventListener('themechange', handler)
    return () => window.removeEventListener('themechange', handler)
  }, [])

  const sevStyles = isDark ? SEVERITY_STYLES.dark : SEVERITY_STYLES.light
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setShowAddForm(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setShowAddForm])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="text-sm text-slate-500 dark:text-gray-500">Loading bugs...</div>
      </div>
    )
  }

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="max-w-md rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-6 text-center">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">Supabase not configured</h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            Create a <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">.env</code> file with:
          </p>
          <pre className="mt-3 rounded-md bg-red-100 dark:bg-red-900/40 p-3 text-left text-xs text-red-800 dark:text-red-300">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <>
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} type={lightbox.type} onClose={() => setLightbox(null)} />}

      {/* Secondary bar — bugs page only */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-slate-200 dark:border-gray-800/50 text-slate-900 dark:text-white">
        <div className="max-w-screen-2xl mx-auto px-7 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 dark:text-gray-500 truncate">
              {testers.join(', ') || 'No testers yet'}
            </p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
              <span className="text-blue-600 dark:text-yellow-400 font-semibold">{activeBugs.length} active</span> / {bugs.length} total
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bugs, testers, devices..."
                className="w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60 py-2 pl-9 pr-16 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-400/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-300 font-mono pointer-events-none">⌘ K</kbd>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus size={16} />
              New Bug
              <kbd className="ml-1 rounded bg-blue-600/60 px-1.5 py-0.5 text-[11px] font-mono">⌘ J</kbd>
            </button>
          </div>
        </div>
      </div>

      <FilterBar
        bugs={bugs}
        activeBugs={activeBugs}
        counts={counts}
        severityFilter={severityFilter}
        setSeverityFilter={filters.setSeverityFilter}
        testerFilter={testerFilter}
        setTesterFilter={filters.setTesterFilter}
        dateFilter={filters.dateFilter}
        setDateFilter={filters.setDateFilter}
        sessionFilter={filters.sessionFilter}
        setSessionFilter={filters.setSessionFilter}
        sortOrder={filters.sortOrder}
        setSortOrder={filters.setSortOrder}
        testers={testers}
        sessions={sessions}
      />

      {/* Content */}
      <div className={`max-w-screen-2xl mx-auto px-7 pt-4 pb-8 transition-opacity duration-150 ${isSearchPending ? 'opacity-60' : 'opacity-100'}`}>
        {showAddForm && (
          <AddBugForm
            onAdd={addBug}
            onCancel={() => setShowAddForm(false)}
            nextIds={nextIds}
            sessions={sessions}
            activeSessionId={sessions.find(s => s.status === 'active')?.id || null}
          />
        )}

        {SEVERITIES.map((s) => {
          const items = grouped[s]
          if (!items || !items.length) return null
          const style = sevStyles[s]
          return (
            <div key={s} className="mb-5">
              <div
                className="mb-2 inline-block rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide"
                style={{ background: style.bg, color: style.text }}
              >
                {s} ({items.length})
              </div>
              {items.map((bug) => (
                <BugCard
                  key={bug.id}
                  bug={bug}
                  onUpdate={updateBug}
                  onDelete={deleteBugFromState}
                  onPersistError={showPersistError}
                  onImageClick={(src, alt, type) => setLightbox({ src, alt, type })}
                  onReviewed={(b, undo) => {
                    if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
                    setSnackbar({ message: `${b.id} marked as completed`, undo })
                    snackbarTimer.current = setTimeout(() => setSnackbar(null), 5000)
                  }}
                />
              ))}
            </div>
          )
        })}

        {severityFilter === 'all' && testerFilter === 'all' && !search && filteredQuestions.length > 0 && (
          <QuestionsSection questions={filteredQuestions} onDelete={deleteQuestion} />
        )}
      </div>
      {snackbar && (
        <div className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${snackbar.undo ? 'bg-slate-800 dark:bg-gray-700' : 'bg-red-600'}`}>
          {snackbar.message}
          {snackbar.undo && (
            <button
              onClick={() => { snackbar.undo!(); clearSnackbar() }}
              className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30 transition-colors cursor-pointer"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  )
}
