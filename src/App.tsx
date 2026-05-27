import React from 'react'
import { Plus, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { supabase } from './supabaseClient'
import { SEVERITIES, SEVERITY_STYLES } from './constants'
import Lightbox, { type LightboxItem } from './components/Lightbox'
import BugCard from './components/BugCard'
import AddBugForm from './components/AddBugForm'
import FilterBar from './components/FilterBar'
import BulkActionBar from './components/BulkActionBar'
import QuestionsSection from './components/QuestionsSection'
import BottomSheet from './components/BottomSheet'
import SecondaryAppBar from './components/SecondaryAppBar'
import PageLoader from './components/PageLoader'
import { BugListSkeleton } from './components/Skeleton'
import { useKonamiLoader } from './hooks/useKonamiLoader'
import { useBugs } from './hooks/useBugs'
import { useBugFilters } from './hooks/useBugFilters'
import { useBulkActions } from './hooks/useBulkActions'
import { usePanelStore } from './stores/panelStore'

interface LightboxState {
  items: LightboxItem[]
  currentIndex: number
}

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
    restoreBug,
    showPersistError,
    addBug,
    addTester,
    deleteQuestion,
    showAddForm,
    setShowAddForm,
  } = useBugs()

  const filters = useBugFilters(bugs, questions, sessions)
  const { search, setSearch, severityFilter, testerFilter, testers, activeBugs, filtered, counts, nextIds, grouped, filteredQuestions, isSearchPending } = filters

  const bulk = useBulkActions()

  const [lightbox, setLightbox] = React.useState<LightboxState | null>(null)
  const [editingBugId, setEditingBugId] = React.useState<string | null>(null)
  const snackbarTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDark = usePanelStore((s) => s.isDark)

  const sevStyles = isDark ? SEVERITY_STYLES.dark : SEVERITY_STYLES.light
  const searchRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
        event.preventDefault()
        setShowAddForm((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setShowAddForm])

  const showLoader = useKonamiLoader()
  if (showLoader) return <PageLoader />

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
      {lightbox && <Lightbox items={lightbox.items} currentIndex={lightbox.currentIndex} onClose={() => setLightbox(null)} />}

      {/* Secondary bar — bugs page only */}
      <SecondaryAppBar
        description=""
        stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{activeBugs.length} active</span> / {bugs.length} total</>}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bugs, testers, devices..."
        searchRef={searchRef}
        showSearchShortcut
        actionButton={
          <button
            onClick={() => setShowAddForm(true)}
            className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
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
        selectionMode={bulk.selectionMode}
        onEnterSelectionMode={bulk.enterSelectionMode}
        filteredBugs={filtered}
      />

      {bulk.selectionMode && (
        <BulkActionBar
          selectedCount={bulk.selectedIds.size}
          totalCount={activeBugs.length}
          progress={bulk.progress}
          allSelected={activeBugs.length > 0 && bulk.selectedIds.size === activeBugs.length}
          onSelectAll={() => bulk.selectAll(activeBugs.map((bug) => bug.id))}
          onDeselectAll={bulk.deselectAll}
          onMarkReviewed={async () => {
            const result = await bulk.bulkMarkReviewed(bugs, updateBug)
            if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
            setSnackbar({ message: `${result.successCount} bug(s) marked as reviewed`, tone: 'success' })
            snackbarTimer.current = setTimeout(() => setSnackbar(null), 3000)
            bulk.setProgress(null)
            bulk.deselectAll()
          }}
          onDelete={async () => {
            const result = await bulk.bulkDelete(bugs, deleteBugFromState)
            if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
            setSnackbar({
              message: `${result.successCount} bug(s) deleted${result.errorCount ? `, ${result.errorCount} failed` : ''}`,
              tone: result.errorCount ? 'warning' : 'success',
            })
            snackbarTimer.current = setTimeout(() => setSnackbar(null), 3000)
            bulk.setProgress(null)
            bulk.deselectAll()
          }}
          onPublish={async () => {
            const result = await bulk.bulkPublish(bugs, updateBug)
            if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
            setSnackbar({
              message: `${result.successCount} bug(s) published${result.errorCount ? `, ${result.errorCount} failed` : ''}`,
              tone: result.errorCount ? 'warning' : 'success',
            })
            snackbarTimer.current = setTimeout(() => setSnackbar(null), 3000)
            bulk.setProgress(null)
            bulk.deselectAll()
          }}
          onExit={bulk.exitSelectionMode}
        />
      )}

      {/* Content */}
      <div className={`max-w-screen-2xl mx-auto px-4 sm:px-7 pt-4 pb-8 transition-opacity duration-150 ${isSearchPending ? 'opacity-60' : 'opacity-100'}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase tracking-tight">Bugs</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Track, triage, and resolve bugs across all active sessions.</p>
        </div>

        {loading ? (
          <BugListSkeleton />
        ) : (
          <>
            {/* Desktop: inline form */}
            {showAddForm && (
              <div className="hidden md:block">
                <AddBugForm
                  onAdd={addBug}
                  onAddTester={addTester}
                  onCancel={() => setShowAddForm(false)}
                  nextIds={nextIds}
                  testers={registeredTesters}
                  sessions={sessions}
                  activeSessionId={sessions.find(s => s.status === 'active')?.id || null}
                  existingBugs={bugs}
                />
              </div>
            )}

            {/* Mobile: bottom sheet */}
            {showAddForm && (
              <div className="md:hidden">
                <BottomSheet onClose={() => setShowAddForm(false)}>
                  <AddBugForm
                    variant="sheet"
                    onAdd={addBug}
                    onAddTester={addTester}
                    onCancel={() => setShowAddForm(false)}
                    nextIds={nextIds}
                    testers={registeredTesters}
                    sessions={sessions}
                    activeSessionId={sessions.find(s => s.status === 'active')?.id || null}
                    existingBugs={bugs}
                  />
                </BottomSheet>
              </div>
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
                      selectionMode={bulk.selectionMode}
                      selected={bulk.selectedIds.has(bug.id)}
                      onToggleSelect={bulk.toggleSelection}
                      onDeleteWithUndo={(deletedBug, hardDelete) => {
                        if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
                        if (deleteTimer.current) clearTimeout(deleteTimer.current)
                        setSnackbar({
                          message: `"${deletedBug.title}" deleted`,
                          tone: 'success',
                          undo: () => {
                            if (deleteTimer.current) clearTimeout(deleteTimer.current)
                            restoreBug(deletedBug)
                          },
                        })
                        deleteTimer.current = setTimeout(async () => {
                          const success = await hardDelete()
                          if (!success) {
                            restoreBug(deletedBug)
                            setSnackbar({ message: `Failed to delete "${deletedBug.title}". It has been restored.`, tone: 'error' })
                            snackbarTimer.current = setTimeout(() => setSnackbar(null), 5000)
                          }
                        }, 5000)
                        snackbarTimer.current = setTimeout(() => setSnackbar(null), 5500)
                      }}
                      onPersistError={showPersistError}
                      onImageClick={(src, alt, type) => {
                        const mediaAttachments = bug.attachments.filter(att =>
                          att.url && (att.type?.startsWith('image/') || att.type?.startsWith('video/') || att.name?.match(/\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|ogg)$/i))
                        )
                        const items: LightboxItem[] = mediaAttachments.map(att => ({
                          src: att.url,
                          alt: att.name,
                          type: att.type?.startsWith('video/') || att.name?.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video' : 'image',
                        }))
                        const currentIndex = items.findIndex(item => item.src === src)
                        setLightbox({ items: items.length ? items : [{ src, alt, type }], currentIndex: Math.max(0, currentIndex) })
                      }}
                      initialEditing={editingBugId === bug.id}
                      onEditingChange={(editing) => setEditingBugId(editing ? bug.id : null)}
                      onLinkCopied={(bugId) => {
                        if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
                        setSnackbar({ message: `Link to ${bugId} copied to clipboard`, tone: 'success' })
                        snackbarTimer.current = setTimeout(() => setSnackbar(null), 3000)
                      }}
                      onReviewed={(b, undo, message) => {
                        if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
                        setSnackbar({ message: message || `${b.id} marked as completed`, tone: 'success', undo })
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
          </>
        )}
      </div>
      {snackbar && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg bg-white dark:bg-mushi-surface border-slate-200 dark:border-gray-700 ${snackbar.tone === 'success' ? 'text-teal-600 dark:text-mushi-primary' : snackbar.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
          {snackbar.tone === 'success' ? <CheckCircle size={16} className="shrink-0" /> : snackbar.tone === 'warning' ? <AlertTriangle size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
          {snackbar.message}
          {snackbar.undo && (
            <button
              onClick={() => { snackbar.undo!(); clearSnackbar() }}
              className="rounded-md bg-teal-50 dark:bg-mushi-primary/10 px-2.5 py-1 text-xs font-bold text-teal-700 dark:text-mushi-primary hover:bg-teal-100 dark:hover:bg-mushi-primary/20 transition-colors cursor-pointer"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  )
}
