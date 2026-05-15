import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'
import type { Bug, Question, Attachment, SessionOption } from '../types'
import type { Severity } from '../constants'

interface SnackbarState {
  message: string
  undo?: () => void
}

interface UseBugsReturn {
  bugs: Bug[]
  questions: Question[]
  sessions: SessionOption[]
  loading: boolean
  snackbar: SnackbarState | null
  setSnackbar: (s: SnackbarState | null) => void
  clearSnackbar: () => void
  updateBug: (updated: Bug) => void
  deleteBugFromState: (bugId: string) => void
  showPersistError: () => void
  addBug: (newBug: NewBugInput) => Promise<void>
  deleteQuestion: (q: Question) => Promise<void>
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>
  showAddForm: boolean
  setShowAddForm: (show: boolean) => void
}

export interface NewBugInput {
  id: string
  title: string
  description: string
  severity: Severity
  tester: string
  device: string
  page: string
  category: string | null
  session_id?: string | null
  attachments: Attachment[]
}

export function useBugs(): UseBugsReturn {
  const [bugs, setBugs] = useState<Bug[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load data from Supabase
  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }
      try {
        const [bugsRes, commentsRes, attachmentsRes, questionsRes, sessionsRes] = await Promise.all([
          supabase.from('bugs').select('*').order('id'),
          supabase.from('comments').select('*').order('created_at'),
          supabase.from('attachments').select('*').order('created_at'),
          supabase.from('open_questions').select('*').order('id'),
          supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false }),
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
        setSessions((sessionsRes.data || []) as SessionOption[])
      } catch (err) {
        console.error('Failed to load data:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Real-time subscriptions so all users stay in sync
  useEffect(() => {
    if (!supabase) return

    const sb = supabase
    const channel = sb.channel('bugs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bugs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newBug = payload.new as Bug
          setBugs((prev) => {
            if (prev.some(b => b.id === newBug.id)) return prev
            return [...prev, { ...newBug, comments: [], attachments: [] }]
          })
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Bug
          setBugs((prev) => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b))
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string }
          setBugs((prev) => prev.filter(b => b.id !== deleted.id))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const c = payload.new as { id: number; bug_id: string; text: string; time?: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== c.bug_id) return b
          if (b.comments.some(cm => cm.id === c.id)) return b
          return { ...b, comments: [...b.comments, c] }
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
        const c = payload.old as { id: number; bug_id: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== c.bug_id) return b
          return { ...b, comments: b.comments.filter(cm => cm.id !== c.id) }
        }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attachments' }, (payload) => {
        const a = payload.new as Attachment & { bug_id: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== a.bug_id) return b
          if (b.attachments.some(at => at.id === a.id)) return b
          return { ...b, attachments: [...b.attachments, a] }
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attachments' }, (payload) => {
        const a = payload.old as { id: number; bug_id: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== a.bug_id) return b
          return { ...b, attachments: b.attachments.filter(at => at.id !== a.id) }
        }))
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  const updateBug = useCallback((updated: Bug) => {
    setBugs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }, [])

  const showPersistError = useCallback(() => {
    setSnackbar({ message: 'It was not possible to update the bug.' })
    window.setTimeout(() => setSnackbar(null), 4000)
  }, [])

  const deleteBugFromState = useCallback((bugId: string) => {
    setBugs((prev) => prev.filter((b) => b.id !== bugId))
  }, [])

  const clearSnackbar = useCallback(() => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
    setSnackbar(null)
  }, [])

  const addBug = async (newBug: NewBugInput) => {
    const filesToUpload = newBug.attachments.filter((a) => a.file)
    const bugData: Record<string, unknown> = {
      id: newBug.id,
      title: newBug.title,
      description: newBug.description,
      severity: newBug.severity,
      tester: newBug.tester,
      device: newBug.device,
      page: newBug.page,
      category: newBug.category,
    }
    if (newBug.session_id) bugData.session_id = newBug.session_id

    if (supabase) {
      const sb = supabase
      const prefix = newBug.id.replace(/\d+$/, '')
      let num = parseInt(newBug.id.replace(/\D+/g, '')) || 1
      let finalId = newBug.id
      let retries = 0

      // Retry with incremented ID on duplicate key conflict (concurrent users)
      while (retries < 20) {
        bugData.id = finalId
        const { error } = await sb.from('bugs').insert(bugData)
        if (!error) break
        if (error.code === '23505') {
          retries++
          num++
          finalId = `${prefix}${String(num).padStart(2, '0')}`
        } else {
          console.error('Failed to add bug:', error)
          return
        }
      }

      // Add bug to state immediately and close form
      setBugs((prev) => [...prev, { ...bugData, id: finalId, comments: [], attachments: [] } as unknown as Bug])
      setShowAddForm(false)

      // Upload attachments in parallel in the background
      if (filesToUpload.length) {
        const results = await Promise.all(
          filesToUpload.map(async (att) => {
            const path = `${finalId}/${Date.now()}-${att.name}`
            const { error: upErr } = await sb.storage.from('attachments').upload(path, att.file!)
            if (upErr) return null
            const { data: urlData } = sb.storage.from('attachments').getPublicUrl(path)
            const { data: row } = await sb
              .from('attachments')
              .insert({ bug_id: finalId, name: att.name, url: urlData.publicUrl, type: att.type })
              .select()
            return row?.[0] as Attachment | undefined
          })
        )
        const uploaded = results.filter((r): r is Attachment => !!r)
        if (uploaded.length) {
          setBugs((prev) => prev.map((b) => b.id === finalId ? { ...b, attachments: [...b.attachments, ...uploaded] } : b))
        }
      }
    } else {
      setBugs((prev) => [...prev, { ...bugData, comments: [], attachments: newBug.attachments } as unknown as Bug])
      setShowAddForm(false)
    }
  }

  const deleteQuestion = async (q: Question) => {
    if (supabase) {
      const { error } = await supabase.from('open_questions').delete().eq('id', q.id)
      if (error) { console.error('Failed to delete question:', error); return }
    }
    setQuestions((prev) => prev.filter((x) => x.id !== q.id))
  }

  return {
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
    setQuestions,
    showAddForm,
    setShowAddForm,
  }
}
