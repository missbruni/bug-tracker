import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Trash2, Sun, Moon, ArrowDownUp, Bug as BugIcon } from 'lucide-react'
import { supabase } from './supabaseClient'
import { SEVERITIES, SEVERITY_STYLES } from './constants'
import CrawlingBugs from './CrawlingBugs'
import Lightbox from './components/Lightbox'
import { TesterBadge } from './components/TesterBadge'
import BugCard, { type Bug } from './components/BugCard'
import AddBugForm from './components/AddBugForm'
import type { Severity } from './constants'
import type { Attachment } from './components/AttachmentCard'

interface Question {
  id: string
  text: string
  tester: string
  created_at?: string
}

interface LightboxState {
  src: string
  alt: string
  type: string
}

export default function App() {
  const [bugs, setBugs] = useState<Bug[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [severityFilter, setSeverityFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('severity') || 'all'
  })
  const [search, setSearch] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('q') || ''
  })
  const [testerFilter, setTesterFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('tester') || 'all'
  })
  const [dateFilter, setDateFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('date') || 'all'
  })
  const [sortOrder, setSortOrder] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('sort') || 'default'
  })

  useEffect(() => {
    const p = new URLSearchParams()
    if (search) p.set('q', search)
    if (severityFilter !== 'all') p.set('severity', severityFilter)
    if (testerFilter !== 'all') p.set('tester', testerFilter)
    if (dateFilter !== 'all') p.set('date', dateFilter)
    if (sortOrder !== 'default') p.set('sort', sortOrder)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [search, severityFilter, testerFilter, dateFilter, sortOrder])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBugs, setShowBugs] = useState(() => localStorage.getItem('showBugs') !== 'false')
  const [themeKey, setThemeKey] = useState(0)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored ? stored === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const sevStyles = darkMode ? SEVERITY_STYLES.dark : SEVERITY_STYLES.light
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setShowBugs(prev => {
          const next = !prev
          localStorage.setItem('showBugs', String(next))
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Load data from Supabase
  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }
      try {
        const [bugsRes, commentsRes, attachmentsRes, questionsRes] = await Promise.all([
          supabase.from('bugs').select('*').order('id'),
          supabase.from('comments').select('*').order('created_at'),
          supabase.from('attachments').select('*').order('created_at'),
          supabase.from('open_questions').select('*').order('id'),
        ])

        const commentsMap: Record<string, Bug['comments']> = {}
        ;((commentsRes.data || []) as Array<Bug['comments'][number] & { bug_id: string }>).forEach((c) => {
          if (!commentsMap[c.bug_id]) commentsMap[c.bug_id] = []
          commentsMap[c.bug_id].push(c)
        })

        const attachmentsMap: Record<string, Attachment[]> = {}
        ;((attachmentsRes.data || []) as Array<Attachment & { bug_id: string }>).forEach((a) => {
          if (!attachmentsMap[a.bug_id]) attachmentsMap[a.bug_id] = []
          attachmentsMap[a.bug_id].push(a)
        })

        const mergedBugs = (bugsRes.data || []).map((b: Bug) => ({
          ...b,
          comments: commentsMap[b.id] || [],
          attachments: attachmentsMap[b.id] || [],
        }))

        setBugs(mergedBugs)
        setQuestions(questionsRes.data as Question[] || [])
      } catch (err) {
        console.error('Failed to load data:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const updateBug = useCallback((updated: Bug) => {
    setBugs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }, [])

  const deleteBugFromState = useCallback((bugId: string) => {
    setBugs((prev) => prev.filter((b) => b.id !== bugId))
  }, [])

  const addBug = async (newBug: { id: string; title: string; description: string; severity: Severity; tester: string; device: string; page: string; category: string | null; attachments: Attachment[] }) => {
    const filesToUpload = newBug.attachments.filter((a) => a.file)
    const bugData = {
      id: newBug.id,
      title: newBug.title,
      description: newBug.description,
      severity: newBug.severity,
      tester: newBug.tester,
      device: newBug.device,
      page: newBug.page,
      category: newBug.category,
    }

    if (supabase) {
      const { error } = await supabase.from('bugs').insert(bugData)
      if (error) {
        console.error('Failed to add bug:', error)
        return
      }

      const uploadedAttachments: Attachment[] = []
      for (const att of filesToUpload) {
        const path = `${newBug.id}/${Date.now()}-${att.name}`
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, att.file!)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
          const { data: row } = await supabase
            .from('attachments')
            .insert({ bug_id: newBug.id, name: att.name, url: urlData.publicUrl, type: att.type })
            .select()
          if (row?.[0]) uploadedAttachments.push(row[0] as Attachment)
        }
      }

      setBugs((prev) => [...prev, { ...bugData, comments: [], attachments: uploadedAttachments } as Bug])
    } else {
      setBugs((prev) => [...prev, { ...bugData, comments: [], attachments: newBug.attachments } as Bug])
    }
    setShowAddForm(false)
  }

  // Derived data
  const testers = [...new Set(bugs.flatMap((b) => b.tester.split(', ')))].sort()

  const filtered = bugs.filter((b) => {
    if (severityFilter !== 'all' && b.severity !== severityFilter) return false
    if (testerFilter !== 'all' && !b.tester.includes(testerFilter)) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !b.title.toLowerCase().includes(q) &&
        !(b.description || '').toLowerCase().includes(q) &&
        !b.id.toLowerCase().includes(q) &&
        !(b.category || '').toLowerCase().includes(q) &&
        !b.page.toLowerCase().includes(q)
      )
        return false
    }
    if (dateFilter !== 'all' && b.created_at) {
      const now = new Date()
      const bugDate = new Date(b.created_at)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (dateFilter === 'today') {
        if (bugDate < startOfToday) return false
      } else if (dateFilter === 'yesterday') {
        const startOfYesterday = new Date(startOfToday)
        startOfYesterday.setDate(startOfYesterday.getDate() - 1)
        if (bugDate < startOfYesterday || bugDate >= startOfToday) return false
      } else if (dateFilter === '7d') {
        const weekAgo = new Date(startOfToday)
        weekAgo.setDate(weekAgo.getDate() - 7)
        if (bugDate < weekAgo) return false
      } else if (dateFilter === '30d') {
        const monthAgo = new Date(startOfToday)
        monthAgo.setDate(monthAgo.getDate() - 30)
        if (bugDate < monthAgo) return false
      }
    }
    return true
  }).sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    if (sortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    return 0
  })

  const counts: Record<Severity, number> = { critical: 0, high: 0, low: 0 }
  bugs.forEach((b) => counts[b.severity]++)

  const nextIds: Record<Severity, number> = {
    critical: bugs.filter((b) => b.severity === 'critical').length + 1,
    high: bugs.filter((b) => b.severity === 'high').length + 1,
    low: bugs.filter((b) => b.severity === 'low').length + 1,
  }

  const grouped: Record<string, Bug[]> = {}
  SEVERITIES.forEach((s) => {
    grouped[s] = filtered.filter((b) => b.severity === s)
  })

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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans">
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} type={lightbox.type} onClose={() => setLightbox(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-40 relative overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-slate-200 dark:border-gray-800/50 text-slate-900 dark:text-white px-7 py-5 flex justify-between items-center">
        {showBugs && <CrawlingBugs count={bugs.filter(b => !b.reviewed).length} />}
        <div className="relative z-10">
          <div className="flex items-baseline gap-3 mb-0.5">
            <h1 className="text-xl font-bold flex items-center gap-1" style={{ fontFamily: "'Press Start 2P', cursive" }}>EVO <button onClick={() => setShowBugs(prev => { const next = !prev; localStorage.setItem('showBugs', String(next)); return next })} className={`transition-colors cursor-pointer ${showBugs ? 'text-green-500 hover:text-green-600' : 'text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400'}`} title={`${showBugs ? 'Hide' : 'Show'} crawling bugs (\u2318B)`}><BugIcon size={20} /></button> IBE</h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-gray-300">Testing Session Triage | Bug Catcher</p>
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500">
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &middot; Bruna, Robert, Nistor, Denisa, Ricardo, Oliwia &middot; <span className="text-blue-600 dark:text-yellow-400 font-semibold">{bugs.filter(b => !b.reviewed).length} active</span> / {bugs.length} total
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bugs..."
              className="w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60 py-2 pl-9 pr-16 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-400/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-300 font-mono pointer-events-none">⌘ K</kbd>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            New Bug
            <kbd className="ml-1 rounded bg-blue-600/60 px-1.5 py-0.5 text-[11px] font-mono">⌘ J</kbd>
          </button>
          <button
            onClick={() => { setDarkMode(!darkMode); setThemeKey(k => k + 1) }}
            className="relative rounded-lg p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer overflow-hidden"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: 34, height: 34 }}
          >
            <span key={`enter-${themeKey}`} className="theme-icon-enter block">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            {themeKey > 0 && (
              <span key={`exit-${themeKey}`} className="theme-icon-exit">
                {darkMode ? <Moon size={18} /> : <Sun size={18} />}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-gray-800 px-7 py-3.5">
        {[
          { k: 'all', l: `All (${bugs.length})` },
          { k: 'critical', l: `Critical (${counts.critical})` },
          { k: 'high', l: `High (${counts.high})` },
          { k: 'low', l: `Low (${counts.low})` },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setSeverityFilter(f.k)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              severityFilter === f.k
                ? 'bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
            }`}
          >
            {f.l}
          </button>
        ))}
        <select
          value={testerFilter}
          onChange={(e) => setTesterFilter(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
        >
          <option value="all">All testers</option>
          {testers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : sortOrder === 'oldest' ? 'default' : 'newest')}
          className={`ml-auto flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            sortOrder !== 'default'
              ? 'bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100'
              : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
          }`}
          title={sortOrder === 'newest' ? 'Newest first' : sortOrder === 'oldest' ? 'Oldest first' : 'Default order'}
        >
          <ArrowDownUp size={12} />
          {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Sort'}
        </button>
      </div>

      {/* Content */}
      <div className="px-7 pt-4 pb-8">
        {showAddForm && (
          <AddBugForm onAdd={addBug} onCancel={() => setShowAddForm(false)} nextIds={nextIds} />
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
                  onImageClick={(src, alt, type) => setLightbox({ src, alt, type })}
                />
              ))}
            </div>
          )
        })}

        {severityFilter === 'all' && testerFilter === 'all' && !search && questions.length > 0 && (() => {
          const deleteQuestion = async (q: Question) => {
            if (supabase) {
              const { error } = await supabase.from('open_questions').delete().eq('id', q.id)
              if (error) { console.error('Failed to delete question:', error); return }
            }
            setQuestions((prev) => prev.filter((x) => x.id !== q.id))
          }
          const filteredQuestions = questions.filter((q) => {
            if (dateFilter === 'all' || !q.created_at) return true
            const now = new Date()
            const qDate = new Date(q.created_at)
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            if (dateFilter === 'today') return qDate >= startOfToday
            if (dateFilter === 'yesterday') {
              const startOfYesterday = new Date(startOfToday)
              startOfYesterday.setDate(startOfYesterday.getDate() - 1)
              return qDate >= startOfYesterday && qDate < startOfToday
            }
            if (dateFilter === '7d') {
              const weekAgo = new Date(startOfToday)
              weekAgo.setDate(weekAgo.getDate() - 7)
              return qDate >= weekAgo
            }
            if (dateFilter === '30d') {
              const monthAgo = new Date(startOfToday)
              monthAgo.setDate(monthAgo.getDate() - 30)
              return qDate >= monthAgo
            }
            return true
          })
          if (!filteredQuestions.length) return null
          return (
          <div className="mt-5">
            <div className="mb-2 inline-block rounded-md bg-blue-50 dark:bg-blue-900/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">
              Open Questions ({filteredQuestions.length})
            </div>
            {filteredQuestions.map((q) => (
              <div
                key={q.id}
                className="mb-2 flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-900 p-3"
                style={{ borderLeft: '4px solid #3b82f6' }}
              >
                <span className="text-xs font-bold text-blue-500 dark:text-blue-400" style={{ minWidth: 36 }}>
                  {q.id}
                </span>
                <span className="flex-1 text-sm text-slate-900 dark:text-gray-200">{q.text}</span>
                <TesterBadge>{q.tester}</TesterBadge>
                <button
                  onClick={() => deleteQuestion(q)}
                  className="shrink-0 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                  title="Delete question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          )
        })()}
      </div>
    </div>
  )
}
