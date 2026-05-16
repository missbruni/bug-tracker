import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { chatCompletion, hasAiConfig, type ChatMessage } from '../lib/aiProvider'
import { supabase } from '../supabaseClient'
import { filesToAttachments } from '../lib/attachments'
import { buildSystemPrompt } from '../lib/aiPrompt'
import { parseBugsFromResponse, parseSessionActions, generateBugId } from '../lib/aiParsers'
import { executeSessionActionWithSession } from '../lib/aiSessionActions'
import { ensureTesterByName } from '../lib/testerLookup'
import type { Severity } from '../constants'
import type { BugPreview, ParsedBug, Message, SessionAction, SessionActionResult } from '../lib/aiTypes'

// ─── Persistence ────────────────────────────────────────────

const STORAGE_KEY = 'ai-assistant-chat'

function loadPersistedState(): { messages: Message[]; currentSessionId: string | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { messages: [], currentSessionId: null }
    const parsed = JSON.parse(raw)
    return {
      messages: parsed.messages ?? [],
      currentSessionId: parsed.currentSessionId ?? null,
    }
  } catch {
    return { messages: [], currentSessionId: null }
  }
}

interface PendingConfirmation {
  action: SessionAction
  phrase: string
  description: string
}

function getPendingConfirmation(action: SessionAction): PendingConfirmation | null {
  if (action.action === 'delete_tester') {
    const name = action.tester?.trim()
    if (!name) return null
    return {
      action,
      phrase: `confirm delete tester ${name.toLowerCase()}`,
      description: `deleting tester "${name}"`,
    }
  }

  if (action.action === 'delete_session') {
    const name = action.name?.trim()
    if (!name) return null
    return {
      action,
      phrase: `confirm delete session ${name.toLowerCase()}`,
      description: `deleting session "${name}"`,
    }
  }

  return null
}

// ─── Hook ───────────────────────────────────────────────────

export default function useAiAssistant(open: boolean) {
  const persisted = useRef(loadPersistedState())
  const [messages, setMessages] = useState<Message[]>(persisted.current.messages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const location = useLocation()

  // Session context
  const [sessionContext, setSessionContext] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(persisted.current.currentSessionId)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)

  // Persist chat state
  useEffect(() => {
    const data = {
      messages: messages.map(m => ({ ...m, bugs: m.bugs?.map(b => ({ ...b, _attachments: undefined })) })),
      currentSessionId,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [messages, currentSessionId])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  // ─── Context fetching ─────────────────────────────────────
  useEffect(() => {
    if (!open || !supabase) return
    ;(async () => {
      const parts: string[] = []

      // Recent sessions with scenario counts
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, name, status')
        .order('created_at', { ascending: false })
        .limit(10)
      if (sessions?.length) {
        const sessionList: string[] = []
        for (const s of sessions) {
          const { count } = await supabase
            .from('scenarios')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', s.id)
          sessionList.push(`${s.name} [${s.status}] (${count ?? 0} scenarios)`)
        }
        parts.push(`Recent sessions:\n${sessionList.map((s, i) => `${i + 1}. ${s}`).join('\n')}`)
      }

      // Active testers
      const { data: testers } = await supabase
        .from('testers')
        .select('name, devices')
        .eq('active', true)
        .order('name')
      if (testers?.length) {
        const testerList = testers.map((t: { name: string; devices: string[] }) =>
          `${t.name} (${t.devices.join(', ')})`
        )
        parts.push(`Active testers:\n${testerList.join('\n')}`)
      }

      // Inactive testers (available to reactivate)
      const { data: inactiveTesters } = await supabase
        .from('testers')
        .select('name')
        .eq('active', false)
        .order('name')
      if (inactiveTesters?.length) {
        parts.push(`Inactive testers (can be reactivated):\n${inactiveTesters.map((t: { name: string }) => t.name).join('\n')}`)
      }

      if (currentSessionId) {
        parts.push(`Current session ID: ${currentSessionId}`)
      }

      // Current page context
      const path = location.pathname + location.hash.replace('#', '')
      const sessionMatch = path.match(/\/sessions\/([^/]+)/)
      if (sessionMatch) {
        const { data: viewedSession } = await supabase.from('sessions').select('name').eq('id', sessionMatch[1]).limit(1).single()
        const name = viewedSession?.name || sessionMatch[1]
        parts.push(`The user is currently viewing session "${name}" (ID: ${sessionMatch[1]}). If they say "this session" or "this" they mean "${name}".`)
      } else if (path.includes('/sessions')) {
        parts.push('The user is currently on the sessions list page.')
      } else if (path.includes('/testers')) {
        parts.push('The user is currently on the tester management page.')
      } else {
        parts.push('The user is currently on the bug tracker main page.')
      }

      // Current user identity from localStorage
      const lastTesterId = localStorage.getItem('lastTesterId')
      if (lastTesterId) {
        const { data: currentTester } = await supabase
          .from('testers')
          .select('name')
          .eq('id', lastTesterId)
          .limit(1)
          .single()
        if (currentTester?.name) {
          parts.push(`The current user is "${currentTester.name}" (tester ID: ${lastTesterId}). Address them by name when appropriate.`)
        }
      }

      setSessionContext(parts.join('\n\n'))
    })()
  }, [open, currentSessionId, location.pathname, location.hash])

  // ─── Focus & keyboard ─────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  // ─── Session action executor ──────────────────────────────
  const executeSessionAction = useCallback(async (action: SessionAction): Promise<SessionActionResult> => {
    if (!supabase) return { action: action.action, success: false, message: 'Database not connected' }

    const actionCtx = {
      sessionId: currentSessionId,
      onSessionCreated: (id: string) => setCurrentSessionId(id),
    }

    if (!currentSessionId) {
      const path = location.pathname + location.hash.replace('#', '')
      const match = path.match(/\/sessions\/([^/]+)/)
      if (match) {
        setCurrentSessionId(match[1])
        actionCtx.sessionId = match[1]
      }
    }

    return executeSessionActionWithSession(action, actionCtx)
  }, [currentSessionId, location.pathname, location.hash])

  // ─── Send message ─────────────────────────────────────────
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return

    if (!hasAiConfig()) {
      setError('AI provider not configured. Open Settings to add your API key.')
      return
    }

    setError('')
    const userMessage: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    scrollToBottom()

    const normalized = text.toLowerCase()

    try {
      // Runtime guard for destructive actions: require explicit confirmation phrase
      if (pendingConfirmation) {
        if (normalized === pendingConfirmation.phrase || ['yes', 'confirm', 'do it'].includes(normalized)) {
          const result = await executeSessionAction(pendingConfirmation.action)
          const sessionIdsToRefresh = new Set<string>()
          if (result.success && result.sessionId) sessionIdsToRefresh.add(result.sessionId)
          if (sessionIdsToRefresh.size > 0) {
            setTimeout(() => {
              for (const sid of sessionIdsToRefresh) {
                window.dispatchEvent(new CustomEvent('sessionDataChanged', { detail: { sessionId: sid } }))
              }
            }, 0)
          }

          const assistantMessage: Message = {
            role: 'assistant',
            content: `Confirmed — ${pendingConfirmation.description}.`,
            sessionActions: [result],
          }
          setPendingConfirmation(null)
          setMessages((prev) => [...prev, assistantMessage])
          scrollToBottom()
        } else if (['cancel', 'no', 'stop', 'never mind', 'nevermind'].includes(normalized)) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `Canceled ${pendingConfirmation.description}.`,
          }
          setPendingConfirmation(null)
          setMessages((prev) => [...prev, assistantMessage])
          scrollToBottom()
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `There is a pending destructive action. Type "${pendingConfirmation.phrase}" to confirm, or "cancel" to abort.`,
          }
          setMessages((prev) => [...prev, assistantMessage])
          scrollToBottom()
        }
        return
      }

      const history: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(sessionContext) },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: text },
      ]

      const response = await chatCompletion(history)

      // Parse bugs
      const bugs = parseBugsFromResponse(response)
      const previews: BugPreview[] = bugs.map((b, i) => ({
        ...b,
        _key: `${Date.now()}-${i}`,
      }))

      // Parse and execute session actions
      const sessionActions = parseSessionActions(response)
      const actionResults: SessionActionResult[] = []
      const sessionIdsToRefresh = new Set<string>()
      let nextPending: PendingConfirmation | null = null
      for (const sa of sessionActions) {
        const confirmation = getPendingConfirmation(sa)
        if (confirmation) {
          nextPending = confirmation
          actionResults.push({
            action: sa.action,
            success: false,
            message: `⚠️ Confirmation required before ${confirmation.description}. Type "${confirmation.phrase}" to continue, or "cancel".`,
          })
          continue
        }

        const result = await executeSessionAction(sa)
        actionResults.push(result)
        if (result.success && result.sessionId) {
          sessionIdsToRefresh.add(result.sessionId)
        }
      }
      if (nextPending) setPendingConfirmation(nextPending)
      // Dispatch outside React batch
      if (sessionIdsToRefresh.size > 0) {
        setTimeout(() => {
          for (const sid of sessionIdsToRefresh) {
            window.dispatchEvent(new CustomEvent('sessionDataChanged', { detail: { sessionId: sid } }))
          }
        }, 0)
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        bugs: previews.length > 0 ? previews : undefined,
        sessionActions: actionResults.length > 0 ? actionResults : undefined,
      }
      setMessages((prev) => [...prev, assistantMessage])
      scrollToBottom()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response')
    } finally {
      setSending(false)
    }
  }, [input, sending, pendingConfirmation, sessionContext, messages, scrollToBottom, executeSessionAction])

  // ─── Bug preview helpers ──────────────────────────────────
  const updateBugPreview = useCallback((messageIndex: number, bugKey: string, field: keyof ParsedBug, value: string) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== messageIndex || !m.bugs) return m
        return {
          ...m,
          bugs: m.bugs.map((b) =>
            b._key === bugKey ? { ...b, [field]: field === 'severity' ? value as Severity : value } : b
          ),
        }
      })
    )
  }, [])

  const addAttachment = useCallback((messageIndex: number, bugKey: string, files: File[]) => {
    const newAtts = filesToAttachments(files)
    setMessages((prev) =>
      prev.map((m, i) =>
        i !== messageIndex || !m.bugs
          ? m
          : { ...m, bugs: m.bugs.map((b) => b._key === bugKey ? { ...b, _attachments: [...(b._attachments || []), ...newAtts] } : b) }
      )
    )
  }, [])

  const removeAttachment = useCallback((messageIndex: number, bugKey: string, attIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i !== messageIndex || !m.bugs
          ? m
          : { ...m, bugs: m.bugs.map((b) => b._key === bugKey ? { ...b, _attachments: (b._attachments || []).filter((_, j) => j !== attIndex) } : b) }
      )
    )
  }, [])

  const createBug = useCallback(async (messageIndex: number, bugKey: string) => {
    const msg = messages[messageIndex]
    const bug = msg?.bugs?.find((b) => b._key === bugKey)
    if (!bug || bug._created || bug._creating) return

    setMessages((prev) =>
      prev.map((m, i) =>
        i !== messageIndex || !m.bugs
          ? m
          : { ...m, bugs: m.bugs.map((b) => (b._key === bugKey ? { ...b, _creating: true } : b)) }
      )
    )

    try {
      const id = await generateBugId(bug.severity)
      const matchedTester = await ensureTesterByName(bug.tester)

      if (supabase) {
        const sb = supabase
        const bugData = {
          id,
          title: bug.title,
          description: bug.description,
          severity: bug.severity,
          tester: matchedTester?.name || bug.tester,
          tester_id: matchedTester?.id || null,
          device: bug.device,
          page: bug.page,
          category: bug.category || null,
        }

        let finalId = id
        let retries = 0
        let inserted = false
        const prefix = id.replace(/\d+$/, '')
        let num = parseInt(id.replace(/\D+/g, '')) || 1

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
            throw new Error(error.message)
          }
        }

        if (!inserted) {
          throw new Error('Failed to create bug after multiple ID retries')
        }

        // Upload attachments
        if (bug._attachments?.length) {
          await Promise.all(
            bug._attachments.map(async (att) => {
              const path = `${finalId}/${Date.now()}-${att.name}`
              const { error: upErr } = await sb.storage.from('attachments').upload(path, att.file!)
              if (upErr) return
              const { data: urlData } = sb.storage.from('attachments').getPublicUrl(path)
              await sb.from('attachments').insert({ bug_id: finalId, name: att.name, url: urlData.publicUrl, type: att.type })
            })
          )
        }

        setMessages((prev) =>
          prev.map((m, i) =>
            i !== messageIndex || !m.bugs
              ? m
              : { ...m, bugs: m.bugs.map((b) => (b._key === bugKey ? { ...b, _creating: false, _created: true, _createdId: finalId } : b)) }
          )
        )
      }
    } catch (err) {
      console.error('Failed to create bug:', err)
      setMessages((prev) =>
        prev.map((m, i) =>
          i !== messageIndex || !m.bugs
            ? m
            : { ...m, bugs: m.bugs.map((b) => (b._key === bugKey ? { ...b, _creating: false } : b)) }
        )
      )
      setError(err instanceof Error ? err.message : 'Failed to create bug')
    }
  }, [messages])

  const createAllBugs = useCallback(async (messageIndex: number) => {
    const msg = messages[messageIndex]
    if (!msg?.bugs) return
    const pending = msg.bugs.filter((b) => !b._created && !b._creating)
    for (const bug of pending) {
      await createBug(messageIndex, bug._key)
    }
  }, [messages, createBug])

  const clearChat = useCallback(() => {
    setMessages([])
    setError('')
    setCurrentSessionId(null)
    setPendingConfirmation(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  const configured = hasAiConfig()

  return {
    // State
    messages,
    input,
    setInput,
    sending,
    error,
    configured,
    // Refs
    chatEndRef,
    inputRef,
    // Actions
    sendMessage,
    clearChat,
    updateBugPreview,
    addAttachment,
    removeAttachment,
    createBug,
    createAllBugs,
  }
}
