import React from 'react'
import { useLocation } from 'react-router-dom'
import { chatCompletion, hasAiConfig, type ChatMessage } from '../lib/aiProvider'
import { supabase } from '../supabaseClient'
import { filesToAttachments } from '../lib/attachments'
import { buildSystemPrompt } from '../lib/aiPrompt'
import { parseBugsFromResponse, parseSessionActions, generateBugId } from '../lib/aiParsers'
import { executeSessionAction as executeSessionActionWithCache } from '../lib/aiSessionActions'
import { ensureTesterByName } from '../lib/testerLookup'
import { useTeamAccess } from '../lib/teamAccess'
import { buildAttachmentPath, scopeToTeam, withTeamPayload } from '../lib/teamScope'
import type { Severity } from '../constants'
import type { BugPreview, ParsedBug, Message, SessionAction, SessionActionResult, BugFiltersActionPayload } from '../lib/aiTypes'

// ─── Persistence ────────────────────────────────────────────

const STORAGE_KEY = 'ai-assistant-chat'

function isBugMainPage(path: string): boolean {
  return !path.includes('/sessions') && !path.includes('/testers')
}

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

// ─── Hook ───────────────────────────────────────────────────

export default function useAiAssistant(open: boolean) {
  const persisted = React.useRef(loadPersistedState())
  const [messages, setMessages] = React.useState<Message[]>(persisted.current.messages)
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState('')
  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const location = useLocation()
  const { pathname } = location
  const { activeTeamId, pinRole } = useTeamAccess()

  // Session context
  const [sessionContext, setSessionContext] = React.useState('')
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(persisted.current.currentSessionId)

  // Persist chat state
  React.useEffect(() => {
    const data = {
      messages: messages.map(m => ({ ...m, bugs: m.bugs?.map(b => ({ ...b, _attachments: undefined })) })),
      currentSessionId,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [messages, currentSessionId])

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }, 50)
  }

  // ─── Context fetching ─────────────────────────────────────
  React.useEffect(() => {
    if (!open || !supabase) return
    ;(async () => {
      const parts: string[] = []

      // Teams and products
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, slug')
        .order('name')
      if (teams?.length) {
        parts.push(`Teams:\n${teams.map((t: { name: string; slug: string }) => `- ${t.name} (${t.slug})`).join('\n')}`)
        if (activeTeamId) {
          const active = teams.find((t: { id: string }) => t.id === activeTeamId)
          if (active) parts.push(`Active team: ${(active as { name: string }).name}`)
        }
      }
      const { data: products } = await supabase
        .from('products')
        .select('name, description, link, team_id')
        .order('name')
      if (products?.length && teams?.length) {
        const teamMap = new Map(teams.map((t: { id: string; name: string }) => [t.id, t.name]))
        const productList = products.map((p: { name: string; description?: string | null; link?: string | null; team_id: string }) => {
          let line = `- ${p.name} (team: ${teamMap.get(p.team_id) || 'unknown'})`
          if (p.description) line += ` — ${p.description}`
          if (p.link) line += ` [${p.link}]`
          return line
        })
        parts.push(`Products:\n${productList.join('\n')}`)
      }

      // Recent sessions with scenario counts
      const { data: sessions } = await scopeToTeam(
        supabase
          .from('sessions')
          .select('id, name, status')
          .order('created_at', { ascending: false })
          .limit(10),
        activeTeamId,
      )
      if (sessions?.length) {
        const sessionList: string[] = []
        for (const s of sessions) {
          const { count } = await scopeToTeam(
            supabase
              .from('scenarios')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', s.id),
            activeTeamId,
          )
          sessionList.push(`${s.name} [${s.status}] (${count ?? 0} scenarios)`)
        }
        parts.push(`Recent sessions:\n${sessionList.map((s, i) => `${i + 1}. ${s}`).join('\n')}`)
      }

      // Active testers
      const { data: testers } = await scopeToTeam(
        supabase
          .from('testers')
          .select('name, devices')
          .eq('active', true)
          .order('name'),
        activeTeamId,
      )
      if (testers?.length) {
        const testerList = testers.map((t: { name: string; devices: string[] }) =>
          `${t.name} (${t.devices.join(', ')})`
        )
        parts.push(`Active testers:\n${testerList.join('\n')}`)
      }

      // Inactive testers (available to reactivate)
      const { data: inactiveTesters } = await scopeToTeam(
        supabase
          .from('testers')
          .select('name')
          .eq('active', false)
          .order('name'),
        activeTeamId,
      )
      if (inactiveTesters?.length) {
        parts.push(`Inactive testers (can be reactivated):\n${inactiveTesters.map((t: { name: string }) => t.name).join('\n')}`)
      }

      if (currentSessionId) {
        parts.push(`Current session ID: ${currentSessionId}`)
      }

      // Current page context
      const path = pathname
      const sessionMatch = path.match(/\/sessions\/([^/]+)/)
      if (sessionMatch) {
        const { data: viewedSession } = await scopeToTeam(
          supabase.from('sessions').select('name').eq('id', sessionMatch[1]).limit(1).single(),
          activeTeamId,
        )
        const name = viewedSession?.name || sessionMatch[1]
        parts.push(`The user is currently viewing session "${name}" (ID: ${sessionMatch[1]}). If they say "this session" or "this" they mean "${name}".`)
      } else if (path.includes('/sessions')) {
        parts.push('The user is currently on the sessions list page.')
      } else if (path.includes('/testers')) {
        parts.push('The user is currently on the tester management page.')
      } else {
        parts.push('The user is currently on the Mushi main page.')
      }

      // Current user identity from localStorage
      const lastTesterId = localStorage.getItem('lastTesterId')
      if (lastTesterId) {
        const { data: currentTester } = await scopeToTeam(
          supabase
            .from('testers')
            .select('name')
            .eq('id', lastTesterId)
            .limit(1)
            .single(),
          activeTeamId,
        )
        if (currentTester?.name) {
          parts.push(`The current user is "${currentTester.name}" (tester ID: ${lastTesterId}). Address them by name when appropriate.`)
        }
      }

      // Recent active bugs for natural language matching
      const { data: activeBugs } = await scopeToTeam(
        supabase
          .from('bugs')
          .select('id, title, severity, tester, device, page, category')
          .eq('reviewed', false)
          .order('created_at', { ascending: false })
          .limit(25),
        activeTeamId,
      )
      if (activeBugs?.length) {
        const bugList = activeBugs.map((b: { id: string; title: string; severity: string; tester: string; device: string; page: string }) =>
          `${b.id}: ${b.title} [${b.severity}] (tester: ${b.tester}, device: ${b.device}, page: ${b.page})`
        )
        parts.push(`Active bugs (${activeBugs.length}):\n${bugList.join('\n')}`)
      }

      // Recent completed bugs
      const { data: completedBugs } = await scopeToTeam(
        supabase
          .from('bugs')
          .select('id, title, severity, tester')
          .eq('reviewed', true)
          .order('created_at', { ascending: false })
          .limit(10),
        activeTeamId,
      )
      if (completedBugs?.length) {
        const bugList = completedBugs.map((b: { id: string; title: string; severity: string; tester: string }) =>
          `${b.id}: ${b.title} [${b.severity}] (tester: ${b.tester})`
        )
        parts.push(`Recent completed bugs (${completedBugs.length}):\n${bugList.join('\n')}`)
      }

      setSessionContext(parts.join('\n\n'))
    })()
  }, [open, currentSessionId, pathname, activeTeamId])

  // ─── Focus & keyboard ─────────────────────────────────────
  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  // ─── Session action executor ──────────────────────────────
  const executeSessionAction = async (action: SessionAction): Promise<SessionActionResult> => {
    if (action.action === 'set_bug_filters') {
      const path = pathname
      if (!isBugMainPage(path)) {
        return {
          action: 'set_bug_filters',
          success: true,
          level: 'warning',
          message: 'I can apply filters from the Bugs page. Open the Mushi Bugs page and ask again.',
        }
      }

      const payload: BugFiltersActionPayload = {
        severity: action.severity,
        severities: action.severities,
        tester: action.tester,
        date: action.date,
        session: action.session,
        sort: action.sort,
        search: action.search,
        clear: action.clear,
      }

      window.dispatchEvent(new CustomEvent<BugFiltersActionPayload>('setBugFiltersFromAi', { detail: payload }))
      return {
        action: 'set_bug_filters',
        success: true,
        level: 'success',
        message: 'Applied bug filters from your request.',
      }
    }

    if (!supabase) return { action: action.action, success: false, level: 'error', message: 'Database not connected' }

    const actionCtx = {
      sessionId: currentSessionId,
      onSessionCreated: (id: string) => setCurrentSessionId(id),
      activeTeamId,
      pinRole,
    }

    if (!currentSessionId) {
      const path = pathname
      const match = path.match(/\/sessions\/([^/]+)/)
      if (match) {
        setCurrentSessionId(match[1])
        actionCtx.sessionId = match[1]
      }
    }

    const result = await executeSessionActionWithCache(action, actionCtx)
    return {
      ...result,
      level: result.level ?? (result.success ? 'success' : 'error'),
    }
  }

  // ─── Send message ─────────────────────────────────────────
  const sendMessage = async (overrideText?: string) => {
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

    try {
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
      for (const sa of sessionActions) {
        const result = await executeSessionAction(sa)
        actionResults.push(result)
        if (result.success && result.sessionId) {
          sessionIdsToRefresh.add(result.sessionId)
        }
      }
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
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  // ─── Bug preview helpers ──────────────────────────────────
  const updateBugPreview = (messageIndex: number, bugKey: string, field: keyof ParsedBug, value: string) => {
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
  }

  const addAttachment = (messageIndex: number, bugKey: string, files: File[]) => {
    const newAtts = filesToAttachments(files)
    setMessages((prev) =>
      prev.map((m, i) =>
        i !== messageIndex || !m.bugs
          ? m
          : { ...m, bugs: m.bugs.map((b) => b._key === bugKey ? { ...b, _attachments: [...(b._attachments || []), ...newAtts] } : b) }
      )
    )
  }

  const removeAttachment = (messageIndex: number, bugKey: string, attIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i !== messageIndex || !m.bugs
          ? m
          : { ...m, bugs: m.bugs.map((b) => b._key === bugKey ? { ...b, _attachments: (b._attachments || []).filter((_, j) => j !== attIndex) } : b) }
      )
    )
  }

  const createBug = async (messageIndex: number, bugKey: string) => {
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
      const id = await generateBugId(bug.severity, activeTeamId)
      const matchedTester = await ensureTesterByName(bug.tester, [], activeTeamId)

      if (!supabase) {
        throw new Error('Database not connected')
      }

      const sb = supabase
      const bugData = withTeamPayload({
        id,
        title: bug.title,
        description: bug.description,
        severity: bug.severity,
        tester: matchedTester?.name || bug.tester,
        tester_id: matchedTester?.id || null,
        device: bug.device,
        page: bug.page,
        category: bug.category || null,
      }, activeTeamId) as Record<string, unknown>

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

      if (bug._attachments?.length) {
        await Promise.all(
          bug._attachments.map(async (att) => {
            const storagePath = buildAttachmentPath(activeTeamId, finalId, att.name)
            const { error: upErr } = await sb.storage.from('attachments').upload(storagePath, att.file!)
            if (upErr) return
            const { data: urlData } = sb.storage.from('attachments').getPublicUrl(storagePath)
            await sb
              .from('attachments')
              .insert(withTeamPayload({ bug_id: finalId, name: att.name, url: urlData.publicUrl, type: att.type }, activeTeamId))
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
  }

  const createAllBugs = async (messageIndex: number) => {
    const msg = messages[messageIndex]
    if (!msg?.bugs) return
    const pending = msg.bugs.filter((b) => !b._created && !b._creating)
    for (const bug of pending) {
      await createBug(messageIndex, bug._key)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError('')
    setCurrentSessionId(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }

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
