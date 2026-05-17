import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { buildAttachmentPath, scopeToTeam, withTeamPayload } from '../lib/teamScope'
import { findTesterByName } from '../lib/testerLookup'
import type { Bug, Question, Attachment, SessionOption, Tester } from '../types'
import type { Severity } from '../constants'

interface SnackbarState {
  message: string
  undo?: () => void
}

interface UseBugsReturn {
  bugs: Bug[]
  questions: Question[]
  sessions: SessionOption[]
  registeredTesters: Array<Pick<Tester, 'id' | 'name'>>
  loading: boolean
  snackbar: SnackbarState | null
  setSnackbar: (s: SnackbarState | null) => void
  clearSnackbar: () => void
  updateBug: (updated: Bug) => void
  deleteBugFromState: (bugId: string) => void
  showPersistError: () => void
  addBug: (newBug: NewBugInput) => Promise<void>
  addTester: (name: string, devices?: string[]) => Promise<Pick<Tester, 'id' | 'name'> | null>
  deleteQuestion: (q: Question) => Promise<void>
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>
  showAddForm: boolean
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>
}

export interface NewBugInput {
  id: string
  title: string
  description: string
  severity: Severity
  tester: string
  tester_id?: string | null
  device: string
  page: string
  category: string | null
  session_id?: string | null
  attachments: Attachment[]
}

export function useBugs(): UseBugsReturn {
  const queryClient = useQueryClient()
  const { activeTeamId } = useTeamAccess()
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bugsQueryKey = ['bugs-data', activeTeamId] as const

  const { data, isLoading: loading } = useQuery({
    queryKey: bugsQueryKey,
    queryFn: async () => {
      if (!supabase) return { bugs: [], questions: [], sessions: [], testers: [] }

      const [bugsRes, commentsRes, attachmentsRes, questionsRes, sessionsRes, testersRes] = await Promise.all([
        scopeToTeam(supabase.from('bugs').select('*').order('id'), activeTeamId),
        scopeToTeam(supabase.from('comments').select('*').order('created_at'), activeTeamId),
        scopeToTeam(supabase.from('attachments').select('*').order('created_at'), activeTeamId),
        scopeToTeam(supabase.from('open_questions').select('*').order('id'), activeTeamId),
        scopeToTeam(
          supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false }),
          activeTeamId,
        ),
        scopeToTeam(supabase.from('testers').select('id, name').eq('active', true).order('name'), activeTeamId),
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

      return {
        bugs: mergedBugs as Bug[],
        questions: (questionsRes.data || []) as Question[],
        sessions: (sessionsRes.data || []) as SessionOption[],
        testers: (testersRes.data || []) as Array<Pick<Tester, 'id' | 'name'>>,
      }
    },
  })

  const bugs = data?.bugs || []
  const questions = data?.questions || []
  const sessions = data?.sessions || []
  const registeredTesters = data?.testers || []

  // Helper to update bugs in the query cache
  const setBugs = useCallback((updater: (prev: Bug[]) => Bug[]) => {
    queryClient.setQueryData(bugsQueryKey, (old: typeof data) => {
      if (!old) return old
      return { ...old, bugs: updater(old.bugs) }
    })
  }, [bugsQueryKey, queryClient])

  const setQuestions = useCallback((updater: React.SetStateAction<Question[]>) => {
    queryClient.setQueryData(bugsQueryKey, (old: typeof data) => {
      if (!old) return old
      const next = typeof updater === 'function' ? updater(old.questions) : updater
      return { ...old, questions: next }
    })
  }, [bugsQueryKey, queryClient])

  const setRegisteredTesters = useCallback((updater: (prev: Array<Pick<Tester, 'id' | 'name'>>) => Array<Pick<Tester, 'id' | 'name'>>) => {
    queryClient.setQueryData(bugsQueryKey, (old: typeof data) => {
      if (!old) return old
      return { ...old, testers: updater(old.testers) }
    })
  }, [bugsQueryKey, queryClient])

  // Real-time subscriptions so all users stay in sync
  useEffect(() => {
    if (!supabase) return

    const sb = supabase

    const scopeConfig = (event: '*' | 'INSERT' | 'DELETE', table: 'bugs' | 'comments' | 'attachments') => ({
      event,
      schema: 'public' as const,
      table,
      ...(activeTeamId ? { filter: `team_id=eq.${activeTeamId}` } : {}),
    })

    const channel = sb.channel('bugs-realtime')
      .on('postgres_changes', scopeConfig('*', 'bugs'), (payload) => {
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
      .on('postgres_changes', scopeConfig('INSERT', 'comments'), (payload) => {
        const c = payload.new as { id: number; bug_id: string; text: string; time?: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== c.bug_id) return b
          if (b.comments.some(cm => cm.id === c.id)) return b
          return { ...b, comments: [...b.comments, c] }
        }))
      })
      .on('postgres_changes', scopeConfig('DELETE', 'comments'), (payload) => {
        const c = payload.old as { id: number; bug_id: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== c.bug_id) return b
          return { ...b, comments: b.comments.filter(cm => cm.id !== c.id) }
        }))
      })
      .on('postgres_changes', scopeConfig('INSERT', 'attachments'), (payload) => {
        const a = payload.new as Attachment & { bug_id: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== a.bug_id) return b
          if (b.attachments.some(at => at.id === a.id)) return b
          return { ...b, attachments: [...b.attachments, a] }
        }))
      })
      .on('postgres_changes', scopeConfig('DELETE', 'attachments'), (payload) => {
        const a = payload.old as { id: number; bug_id: string }
        setBugs((prev) => prev.map(b => {
          if (b.id !== a.bug_id) return b
          return { ...b, attachments: b.attachments.filter(at => at.id !== a.id) }
        }))
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [activeTeamId, setBugs])

  const updateBug = useCallback((updated: Bug) => {
    setBugs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }, [setBugs])

  const showPersistError = useCallback(() => {
    setSnackbar({ message: 'It was not possible to update the bug.' })
    window.setTimeout(() => setSnackbar(null), 4000)
  }, [])

  const deleteBugFromState = useCallback((bugId: string) => {
    setBugs((prev) => prev.filter((b) => b.id !== bugId))
  }, [setBugs])

  const clearSnackbar = useCallback(() => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current)
    setSnackbar(null)
  }, [])

  const addTester = async (name: string, devices: string[] = []): Promise<Pick<Tester, 'id' | 'name'> | null> => {
    if (!supabase) return null
    const normalized = name.trim()
    if (!normalized) return null

    const { data: existing, error: existingErr } = await scopeToTeam(
      supabase
        .from('testers')
        .select('id, name, active')
        .ilike('name', normalized)
        .limit(1),
      activeTeamId,
    )

    if (existingErr) {
      console.error('Failed to check existing tester:', existingErr)
      return null
    }

    if (existing?.length) {
      const row = existing[0] as { id: string; name: string; active: boolean }
      if (!row.active) {
        const updatePayload: { active: boolean; devices?: string[] } = { active: true }
        if (devices.length) updatePayload.devices = devices
        let reactivateQuery = supabase
          .from('testers')
          .update(updatePayload)
          .eq('id', row.id)
        reactivateQuery = scopeToTeam(reactivateQuery, activeTeamId)
        const { error: reactivateErr } = await reactivateQuery
        if (reactivateErr) {
          console.error('Failed to reactivate tester:', reactivateErr)
          return null
        }
      }

      const result = { id: row.id, name: row.name }
      setRegisteredTesters(prev => {
        const next = prev.some(t => t.id === result.id) ? prev : [...prev, result]
        return next.sort((a, b) => a.name.localeCompare(b.name))
      })
      return result
    }

    const { data: created, error: createErr } = await supabase
      .from('testers')
      .insert(withTeamPayload({ name: normalized, devices, active: true }, activeTeamId))
      .select('id, name')
      .single()

    if (createErr || !created) {
      console.error('Failed to create tester:', createErr)
      return null
    }

    const result = { id: created.id as string, name: created.name as string }
    setRegisteredTesters(prev => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
    return result
  }

  const addBug = async (newBug: NewBugInput) => {
    const filesToUpload = newBug.attachments.filter((a) => a.file)
    let resolvedTesterId = newBug.tester_id || null
    if (!resolvedTesterId) {
      const matchedTester = await findTesterByName(newBug.tester, activeTeamId)
      resolvedTesterId = matchedTester?.id || null
    }

    const bugData = withTeamPayload({
      id: newBug.id,
      title: newBug.title,
      description: newBug.description,
      severity: newBug.severity,
      tester: newBug.tester,
      tester_id: resolvedTesterId,
      device: newBug.device,
      page: newBug.page,
      category: newBug.category,
    }, activeTeamId) as Record<string, unknown>
    if (newBug.session_id) bugData.session_id = newBug.session_id

    if (supabase) {
      const sb = supabase
      const prefix = newBug.id.replace(/\d+$/, '')
      let num = parseInt(newBug.id.replace(/\D+/g, '')) || 1
      let finalId = newBug.id
      let retries = 0
      let inserted = false

      // Retry with incremented ID on duplicate key conflict (concurrent users)
      while (retries < 20) {
        bugData.id = finalId
        const { error } = await sb.from('bugs').insert(bugData)
        if (!error) {
          inserted = true
          break
        }
        if (error.code === '23505') {
          retries++
          num++
          finalId = `${prefix}${String(num).padStart(2, '0')}`
        } else {
          console.error('Failed to add bug:', error)
          return
        }
      }

      if (!inserted) {
        console.error('Failed to add bug after multiple ID retries')
        setSnackbar({ message: 'Failed to create bug after multiple retries.' })
        return
      }

      // Add bug to state immediately and close form
      setBugs((prev) => [...prev, { ...bugData, id: finalId, comments: [], attachments: [] } as unknown as Bug])
      setShowAddForm(false)

      // Upload attachments in parallel in the background
      if (filesToUpload.length) {
        const results = await Promise.all(
          filesToUpload.map(async (att) => {
            const storagePath = buildAttachmentPath(activeTeamId, finalId, att.name)
            const { error: upErr } = await sb.storage.from('attachments').upload(storagePath, att.file!)
            if (upErr) return null
            const { data: urlData } = sb.storage.from('attachments').getPublicUrl(storagePath)
            const { data: row } = await sb
              .from('attachments')
              .insert(withTeamPayload({ bug_id: finalId, name: att.name, url: urlData.publicUrl, type: att.type }, activeTeamId))
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
      let deleteQuery = supabase.from('open_questions').delete().eq('id', q.id)
      deleteQuery = scopeToTeam(deleteQuery, activeTeamId)
      const { error } = await deleteQuery
      if (error) { console.error('Failed to delete question:', error); return }
    }
    setQuestions((prev) => prev.filter((x) => x.id !== q.id))
  }

  return {
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
    setQuestions,
    showAddForm,
    setShowAddForm,
  }
}
