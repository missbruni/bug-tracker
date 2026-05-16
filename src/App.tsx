import { useState, useEffect, useRef } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { supabase } from './supabaseClient'
import { SEVERITIES, SEVERITY_STYLES } from './constants'
import Lightbox from './components/Lightbox'
import BugCard from './components/BugCard'
import AddBugForm from './components/AddBugForm'
import FilterBar from './components/FilterBar'
import QuestionsSection from './components/QuestionsSection'
import SecondaryAppBar from './components/SecondaryAppBar'
import { useBugs } from './hooks/useBugs'
import { useBugFilters } from './hooks/useBugFilters'
import type { LightboxState } from './types'

export default function App() {
  const {
    bugs,
    questions,
    sessions,
    registeredTesters,
    loading,
    snackbar,
    setSnackbar,
    clearSnackbar,
    updateBug,
    deleteBugFromState,
    showPersistError,
    addBug,
    addTester,
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
        setShowAddForm((prev) => !prev)
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
      <SecondaryAppBar
        description={testers.join(', ') || 'No testers yet'}
        stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{activeBugs.length} active</span> / {bugs.length} total</>}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bugs, testers, devices..."
        searchRef={searchRef}
        showSearchShortcut
        actionButton={
          <button
            onClick={() => setShowAddForm(true)}
            className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            New Bug
            <kbd className="ml-1 rounded bg-blue-600/60 px-1.5 py-0.5 text-[10px] font-mono">⌘ J</kbd>
          </button>
        }
      />

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
            onAddTester={addTester}
            onCancel={() => setShowAddForm(false)}
            nextIds={nextIds}
            testers={registeredTesters}
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
