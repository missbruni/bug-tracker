import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Sparkles, Send, Check, Pencil, Loader2, AlertCircle, Settings, Trash2, Paperclip } from 'lucide-react'
import { chatCompletion, hasAiConfig, type ChatMessage } from '../lib/aiProvider'
import { supabase } from '../supabaseClient'
import { SEVERITIES, SEVERITY_STYLES, PAGES } from '../constants'
import { filesToAttachments, getImageFilesFromPaste } from '../lib/attachments'
import AttachmentCard from './AttachmentCard'
import type { Severity } from '../constants'
import type { Attachment } from '../types'

// ─── Types ──────────────────────────────────────────────────

interface ParsedBug {
  title: string
  description: string
  severity: Severity
  tester: string
  device: string
  page: string
  category: string
}

interface BugPreview extends ParsedBug {
  _key: string
  _created?: boolean
  _createdId?: string
  _creating?: boolean
  _attachments?: Attachment[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  bugs?: BugPreview[]
}

interface AiAssistantPanelProps {
  open: boolean
  onClose: () => void
  onOpenSettings: () => void
}

// ─── System prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are a bug-logging assistant for a QA testing tool called EVO Bug Catcher.

Your ONLY purpose is to help testers log bugs, improve bug descriptions, find or query existing bugs, and discuss bug-related topics. You must NOT answer questions or engage in conversations about anything else.

If a user asks about anything unrelated to bugs, testing, or QA — such as general knowledge, coding help, jokes, recipes, opinions, or any off-topic request — politely decline and redirect them. For example: "I'm here to help you log and manage bugs! 🐛 Tell me about any issues you've found and I'll help you create structured bug reports."

IMPORTANT RULES:
- When the user provides context that applies to multiple bugs (like their name, device, or the page they're testing), remember and reuse it for all subsequent bugs until they say otherwise.
- If information is missing, use reasonable defaults: severity defaults to "high", device defaults to "—", page defaults to "—", category defaults to empty string.
- Severity must be one of: "critical", "high", "low".
- Always respond with a friendly short acknowledgment AND a JSON block.
- You may help the user rephrase or improve a bug description, suggest a better title, or clarify severity.
- You may answer questions about how to describe bugs effectively.

Your response format MUST always include a JSON code block with the extracted bugs:

\`\`\`json
[
  {
    "title": "Short bug title",
    "description": "Detailed description of the bug",
    "severity": "high",
    "tester": "Tester Name",
    "device": "Device / Browser",
    "page": "Page or screen name",
    "category": "Optional category"
  }
]
\`\`\`

If the user's message is just a greeting or doesn't contain bug information, respond with a SHORT friendly greeting (max 2-3 sentences) and ask them to share: their name, device, page, and what went wrong. Keep it very brief.

If the user asks to modify a previously suggested bug, output the corrected version in the same JSON format.`

// ─── Helpers ────────────────────────────────────────────────

function parseBugsFromResponse(text: string): ParsedBug[] {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (!jsonMatch) return []
  try {
    const parsed = JSON.parse(jsonMatch[1])
    if (!Array.isArray(parsed)) return []
    return parsed.map((b: Record<string, unknown>) => ({
      title: String(b.title || ''),
      description: String(b.description || ''),
      severity: SEVERITIES.includes(b.severity as Severity) ? (b.severity as Severity) : 'high',
      tester: String(b.tester || 'Unknown'),
      device: String(b.device || '\u2014'),
      page: String(b.page || '\u2014'),
      category: String(b.category || ''),
    }))
  } catch {
    return []
  }
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/g, '').trim()
}

async function generateBugId(severity: Severity): Promise<string> {
  const prefix = severity === 'critical' ? 'CRT' : severity === 'high' ? 'HI' : 'LO'
  if (!supabase) return `${prefix}-01`

  const { data } = await supabase
    .from('bugs')
    .select('id')
    .like('id', `${prefix}-%`)
    .order('id', { ascending: false })
    .limit(50)

  let maxNum = 0
  ;(data || []).forEach((row: { id: string }) => {
    const num = parseInt(row.id.replace(/\D+/g, '')) || 0
    if (num > maxNum) maxNum = num
  })
  return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`
}

// ─── Component ──────────────────────────────────────────────

export default function AiAssistantPanel({ open, onClose, onOpenSettings }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const sendMessage = async () => {
    const text = input.trim()
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
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: text },
      ]

      const response = await chatCompletion(history)
      const bugs = parseBugsFromResponse(response)
      const previews: BugPreview[] = bugs.map((b, i) => ({
        ...b,
        _key: `${Date.now()}-${i}`,
      }))

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        bugs: previews.length > 0 ? previews : undefined,
      }
      setMessages((prev) => [...prev, assistantMessage])
      scrollToBottom()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response')
    } finally {
      setSending(false)
    }
  }

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

    // Mark as creating
    setMessages((prev) =>
      prev.map((m, i) =>
        i !== messageIndex || !m.bugs
          ? m
          : { ...m, bugs: m.bugs.map((b) => (b._key === bugKey ? { ...b, _creating: true } : b)) }
      )
    )

    try {
      const id = await generateBugId(bug.severity)

      if (supabase) {
        const sb = supabase
        const bugData = {
          id,
          title: bug.title,
          description: bug.description,
          severity: bug.severity,
          tester: bug.tester,
          device: bug.device,
          page: bug.page,
          category: bug.category || null,
        }

        let finalId = id
        let retries = 0
        const prefix = id.replace(/\d+$/, '')
        let num = parseInt(id.replace(/\D+/g, '')) || 1

        while (retries < 20) {
          bugData.id = finalId
          const { error } = await sb.from('bugs').insert(bugData)
          if (!error) break
          if (error.code === '23505') {
            retries++
            num++
            finalId = `${prefix}${String(num).padStart(2, '0')}`
          } else {
            throw new Error(error.message)
          }
        }

        // Upload attachments in the background
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
  }

  const createAllBugs = async (messageIndex: number) => {
    const msg = messages[messageIndex]
    if (!msg?.bugs) return
    const pending = msg.bugs.filter((b) => !b._created && !b._creating)
    for (const bug of pending) {
      await createBug(messageIndex, bug._key)
    }
  }

  const configured = hasAiConfig()

  return (
    <>
      {/* Backdrop — mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 transition-opacity lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel — overlay on mobile, push on desktop */}
      <div
        className={`fixed right-0 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border-l border-slate-200 dark:border-gray-800 shadow-xl transform transition-transform duration-200 ease-in-out flex flex-col top-0 h-full lg:top-[var(--navbar-h,49px)] lg:h-[calc(100vh-var(--navbar-h,49px))] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800 shrink-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Sparkles size={16} className="text-amber-500" />
            Bug Assistant
          </h2>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError('') }}
                className="text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer p-1 rounded"
                title="Clear chat"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!configured && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
              <AlertCircle size={20} className="mx-auto mb-2 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                Configure your AI provider to start using the Bug Assistant.
              </p>
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors cursor-pointer"
              >
                <Settings size={12} />
                Open Settings
              </button>
            </div>
          )}

          {configured && messages.length === 0 && (
            <div className="text-center pt-8">
              <Sparkles size={28} className="mx-auto mb-3 text-amber-400 opacity-60" />
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Describe your bugs naturally
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                Mention your name, device, and the bugs you found. The assistant will create structured bug entries for you to review and confirm.
              </p>
            </div>
          )}

          {messages.map((msg, mi) => (
            <div key={mi}>
              {/* Message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-200'
                  }`}
                >
                  {msg.role === 'assistant' ? stripJsonBlock(msg.content) : msg.content}
                </div>
              </div>

              {/* Bug preview cards */}
              {msg.bugs && msg.bugs.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {msg.bugs.map((bug) => (
                    <BugPreviewCard
                      key={bug._key}
                      bug={bug}
                      onUpdate={(field, value) => updateBugPreview(mi, bug._key, field, value)}
                      onCreate={() => createBug(mi, bug._key)}
                      onAddFiles={(files) => addAttachment(mi, bug._key, files)}
                      onRemoveFile={(idx) => removeAttachment(mi, bug._key, idx)}
                    />
                  ))}
                  {msg.bugs.some((b) => !b._created) && (
                    <button
                      onClick={() => createAllBugs(mi)}
                      disabled={msg.bugs.every((b) => b._created || b._creating)}
                      className="w-full rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
                    >
                      Create All ({msg.bugs.filter((b) => !b._created).length})
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-slate-100 dark:bg-gray-800 px-4 py-3">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 dark:border-gray-800 px-4 py-3 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={configured ? 'Describe the bugs you found...' : 'Configure AI provider in Settings first'}
              disabled={!configured || sending}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !configured || sending}
              className="rounded-lg bg-blue-500 p-2.5 text-white hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-gray-600">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Bug Preview Card ───────────────────────────────────────

function BugPreviewCard({
  bug,
  onUpdate,
  onCreate,
  onAddFiles,
  onRemoveFile,
}: {
  bug: BugPreview
  onUpdate: (field: keyof ParsedBug, value: string) => void
  onCreate: () => void
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sevStyle = SEVERITY_STYLES.dark[bug.severity]
  const attachments = bug._attachments || []

  const handlePaste = (e: React.ClipboardEvent) => {
    const imageFiles = getImageFilesFromPaste(e)
    if (imageFiles.length) {
      e.preventDefault()
      onAddFiles(imageFiles)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) onAddFiles(files)
    e.target.value = ''
  }

  if (bug._created) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 px-3.5 py-2.5 flex items-center gap-2">
        <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
        <span className="text-xs font-semibold text-green-700 dark:text-green-400">{bug._createdId}</span>
        <span className="text-xs text-green-600 dark:text-green-500 truncate">{bug.title}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/80 overflow-hidden" onPaste={handlePaste}>
      {/* Header — severity badge + title + edit toggle */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shrink-0 leading-none"
          style={{ background: sevStyle.badge }}
        >
          {bug.severity}
        </span>
        <span className="flex-1 text-xs font-semibold text-gray-100 truncate">{bug.title}</span>
        <button
          onClick={() => setEditing(!editing)}
          className={`shrink-0 cursor-pointer transition-colors ${editing ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          title={editing ? 'Done editing' : 'Edit'}
        >
          <Pencil size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {editing ? (
          <div className="space-y-2 pt-1 border-t border-gray-700/50">
            <textarea
              value={bug.description}
              onChange={(e) => onUpdate('description', e.target.value)}
              rows={2}
              className="w-full text-[11px] text-gray-300 bg-gray-900/50 outline-none border border-gray-600 rounded px-2 py-1 mt-1.5 resize-none focus:border-blue-500"
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={bug.severity}
                onChange={(e) => onUpdate('severity', e.target.value)}
                className="text-[11px] text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <input
                value={bug.tester}
                onChange={(e) => onUpdate('tester', e.target.value)}
                className="text-[11px] text-gray-300 bg-gray-900/50 outline-none border border-gray-600 rounded px-2 py-1 focus:border-blue-500"
                placeholder="Tester"
              />
              <input
                value={bug.device}
                onChange={(e) => onUpdate('device', e.target.value)}
                className="text-[11px] text-gray-300 bg-gray-900/50 outline-none border border-gray-600 rounded px-2 py-1 focus:border-blue-500"
                placeholder="Device"
              />
              <select
                value={bug.page}
                onChange={(e) => onUpdate('page', e.target.value)}
                className="text-[11px] text-gray-300 bg-gray-900/50 border border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-500"
              >
                <option value="" disabled hidden>Page</option>
                {PAGES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <input
              value={bug.category}
              onChange={(e) => onUpdate('category', e.target.value)}
              className="w-full text-[11px] text-gray-300 bg-gray-900/50 outline-none border border-gray-600 rounded px-2 py-1 focus:border-blue-500"
              placeholder="Category (optional)"
            />
          </div>
        ) : (
          <>
            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{bug.description}</p>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[10px] text-gray-500">
              {bug.tester !== '\u2014' && <span>{bug.tester}</span>}
              <span>{bug.device}</span>
              {bug.page !== '\u2014' && <span>{bug.page}</span>}
              {bug.category && <span className="text-gray-600">{bug.category}</span>}
            </div>
          </>
        )}

        {/* Attachment thumbnails */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2" style={{ '--card-scale': '0.6' } as React.CSSProperties}>
            {attachments.map((att, i) => (
              <AttachmentCard key={i} att={att} onRemove={() => onRemoveFile(i)} />
            ))}
          </div>
        )}
      </div>

      {/* Footer — attach + paste hint + create */}
      <div className="px-3 py-1.5 border-t border-gray-700/50 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer shrink-0"
        >
          <Paperclip size={11} />
          Attach
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
        {attachments.length === 0 && (
          <div className="flex-1 border border-dashed border-gray-600 rounded px-2 py-1 text-[9px] text-gray-500 text-center truncate">
            or paste screenshot here
          </div>
        )}
        {attachments.length > 0 && <div className="flex-1" />}
        <button
          onClick={onCreate}
          disabled={bug._creating}
          className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {bug._creating ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check size={10} />
              Create Bug
            </>
          )}
        </button>
      </div>
    </div>
  )
}
