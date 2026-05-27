import React from 'react'
import { X, Send, Check, AlertCircle, Settings, Trash2, ExternalLink, Bug, CalendarPlus, Bot } from 'lucide-react'
import { Link } from 'react-router-dom'
import { stripJsonBlock } from '../lib/aiParsers'
import AiBugPreviewCard from './AiBugPreviewCard'
import useAiAssistant from '../hooks/useAiAssistant'

const BUG_ID_PATTERN = /\b((?:CRT|HI|LO)-\d{2,})\b/g

function renderMessageWithBugLinks(text: string, linkClass: string): React.ReactNode {
  const matches = [...text.matchAll(BUG_ID_PATTERN)]
  if (!matches.length) return text

  const elements: React.ReactNode[] = []
  let cursor = 0
  for (const match of matches) {
    const bugId = match[1]
    const start = match.index!
    if (start > cursor) elements.push(text.slice(cursor, start))
    elements.push(
      <button
        key={`${bugId}-${start}`}
        onClick={() => {
          const element = document.getElementById(`bug-${bugId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.add('ring-2', 'ring-amber-400')
            setTimeout(() => element.classList.remove('ring-2', 'ring-amber-400'), 2000)
          }
        }}
        className={`font-bold underline cursor-pointer hover:opacity-80 ${linkClass}`}
      >
        {bugId}
      </button>
    )
    cursor = start + match[0].length
  }
  if (cursor < text.length) elements.push(text.slice(cursor))
  return <>{elements}</>
}

// ─── Component ──────────────────────────────────────────────

interface AiAssistantPanelProps {
  open: boolean
  onClose: () => void
  onOpenSettings: () => void
}

const BUG_FIELD_BLOCK_PATTERNS = [
  /(?:^|\s)[-*•]\s*\*\*(title|description|severity|tester|device|page|category)\*\*:/i,
  /(?:^|\n)\s*\*\*(title|description|severity|tester|device|page|category)\*\*:/i,
  /(?:^|\s)[-*•]\s*(title|description|severity|tester|device|page|category)\s*:/i,
]

function stripBugFieldEcho(text: string): string {
  const matchIndexes = BUG_FIELD_BLOCK_PATTERNS
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)

  if (matchIndexes.length === 0) return text.trim()

  const firstMatchIndex = Math.min(...matchIndexes)
  return text.slice(0, firstMatchIndex).trim()
}

export default function AiAssistantPanel({ open, onClose, onOpenSettings }: AiAssistantPanelProps) {
  const {
    messages, input, setInput, sending, error, configured,
    chatEndRef, inputRef,
    sendMessage, clearChat,
    updateBugPreview, addAttachment, removeAttachment, createBug, createAllBugs,
  } = useAiAssistant(open)

  // Escape key to close
  React.useEffect(() => {
    if (!open) return
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

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
        className={`fixed right-0 z-50 lg:z-30 w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border-l border-slate-200 dark:border-gray-800 shadow-xl transform transition-transform duration-200 ease-in-out flex flex-col top-0 h-full lg:top-[var(--navbar-h,49px)] lg:h-[calc(100vh-var(--navbar-h,49px))] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800 shrink-0">
          <h2 className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-white">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-mushi-primary/15">
              <Bot size={16} className="text-blue-600 dark:text-mushi-primary" />
            </span>
            <span className="flex flex-col">
              <span>AI Assistant</span>
              <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest font-heading text-blue-500 dark:text-mushi-primary"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-mushi-primary animate-pulse" />Active Listening</span>
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
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
                Configure your AI provider to start using the AI Assistant.
              </p>
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-on-warning hover:bg-amber-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:focus-visible:ring-offset-gray-900"
              >
                <Settings size={12} />
                Open Settings
              </button>
            </div>
          )}

          {configured && messages.length === 0 && (
            <div className="text-center pt-8">
              <Bot size={28} className="mx-auto mb-3 text-blue-400 dark:text-mushi-primary opacity-60" />
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Bugs & Sessions
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500 leading-relaxed max-w-[280px] mx-auto mb-5">
                Describe bugs to log them, or ask me to set up a new testing session.
              </p>
              <div className="flex flex-col gap-2 max-w-[260px] mx-auto">
                {[
                  { icon: Bug, label: 'Log a new bug', prompt: 'I want to log a new bug' },
                  { icon: CalendarPlus, label: 'Create a testing session', prompt: 'I want to create a new testing session' },
                ].map((shortcut) => (
                  <button
                    key={shortcut.label}
                    onClick={() => sendMessage(shortcut.prompt)}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-left text-xs text-slate-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group"
                  >
                    <shortcut.icon size={14} className="text-slate-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors shrink-0" />
                    {shortcut.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, mi) => {
            const plainAssistantText = msg.role === 'assistant' ? stripJsonBlock(msg.content).trim() : ''
            const pendingBugs = (msg.bugs ?? []).filter((bug) => !bug._created)
            const createdBugs = (msg.bugs ?? []).filter((bug) => bug._created)
            const createdBugIds = createdBugs
              .map((bug) => bug._createdId)
              .filter((bugId): bugId is string => Boolean(bugId))
            const hasBugPreviews = msg.role === 'assistant' && Boolean(msg.bugs?.length)
            const hasPendingBugPreviews = msg.role === 'assistant' && pendingBugs.length > 0
            const hasCreatedOnlyBugPreviews = msg.role === 'assistant' && createdBugs.length > 0 && pendingBugs.length === 0
            const bugReviewPrompt = (msg.bugs?.length ?? 0) > 1
              ? 'Heads up — these are draft bug cards based on your message. Review or edit anything you want, then tap Create All to log them.'
              : 'Heads up — this is a draft bug card based on your message. Review or edit anything you want, then tap Create Bug to log it.'
            const bugCreatedPrompt = createdBugs.length > 1
              ? createdBugIds.length > 0
                ? `All set — your bugs are logged (${createdBugIds.join(', ')}).`
                : 'All set — your bugs are logged.'
              : createdBugIds[0]
                ? `All set — your bug is logged as ${createdBugIds[0]}.`
                : 'All set — your bug is logged.'
            const assistantText = msg.role === 'assistant'
              ? hasPendingBugPreviews
                ? bugReviewPrompt
                : hasCreatedOnlyBugPreviews
                  ? bugCreatedPrompt
                : hasBugPreviews
                  ? stripBugFieldEcho(plainAssistantText)
                  : plainAssistantText
              : msg.content

            const shouldRenderBubble = msg.role === 'user' || Boolean(assistantText)
            const visibleSessionActions = (msg.sessionActions ?? []).filter((result) => {
              const level = result.level ?? (result.success ? 'success' : 'error')
              return level !== 'success'
            })

            return (
              <div key={mi}>
                {/* Message bubble */}
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-mushi-primary/15 flex items-center justify-center mt-0.5">
                        <Bot size={16} className="text-blue-600 dark:text-mushi-primary" />
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">Mushi-Bot</span>
                    </div>
                  )}
                  {shouldRenderBubble && (
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white dark:text-mushi-bg'
                          : 'bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-200'
                      }`}
                    >
                      {assistantText}
                    </div>
                  )}
                </div>

                {/* Bug preview cards */}
                {pendingBugs.length > 0 && (
                  <div className="mt-3 space-y-2.5">
                    {pendingBugs.map((bug) => (
                      <AiBugPreviewCard
                        key={bug._key}
                        bug={bug}
                        onUpdate={(field, value) => updateBugPreview(mi, bug._key, field, value)}
                        onCreate={() => createBug(mi, bug._key)}
                        onAddFiles={(files) => addAttachment(mi, bug._key, files)}
                        onRemoveFile={(idx) => removeAttachment(mi, bug._key, idx)}
                      />
                    ))}
                    {pendingBugs.length > 0 && (
                      <button
                        onClick={() => createAllBugs(mi)}
                        disabled={pendingBugs.every((bug) => bug._creating)}
                        className="w-full rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
                      >
                        Create All ({pendingBugs.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Session action results */}
                {visibleSessionActions.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {visibleSessionActions.map((result, resultIndex) => {
                      const level = result.level ?? (result.success ? 'success' : 'error')
                      const isProminent = level === 'warning' || level === 'error'

                      const containerClass = isProminent
                        ? level === 'warning'
                          ? 'rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2'
                          : 'rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-2'
                        : 'inline-flex w-fit max-w-full items-center gap-1.5 rounded-md bg-slate-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] text-slate-600 dark:text-gray-300'

                      const iconClass = level === 'warning'
                        ? 'shrink-0 text-amber-500 dark:text-amber-400'
                        : level === 'error'
                          ? 'shrink-0 text-red-500 dark:text-red-400'
                          : 'shrink-0 text-slate-500 dark:text-gray-400'

                      const linkClass = level === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : level === 'error'
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-blue-600 dark:text-blue-400'

                      return (
                        <div key={resultIndex} className={containerClass}>
                          {level === 'error' || level === 'warning'
                            ? <AlertCircle size={14} className={iconClass} />
                            : <Check size={12} className={iconClass} />
                          }
                          <span className={isProminent ? 'flex-1 whitespace-pre-line' : 'truncate'}>
                            {renderMessageWithBugLinks(result.message, linkClass)}
                          </span>
                          {result.success && result.sessionId && result.action === 'create_session' && (
                            <Link
                              to={`/sessions/${result.sessionId}`}
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold hover:underline shrink-0 ${linkClass}`}
                            >
                              Open <ExternalLink size={10} />
                            </Link>
                          )}
                          {['remove_tester', 'reactivate_tester', 'add_tester', 'delete_tester'].includes(result.action) && (
                            <Link
                              to="/testers"
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold hover:underline shrink-0 ${linkClass}`}
                            >
                              Testers <ExternalLink size={10} />
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {sending && (
            <div className="flex justify-start gap-2">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-mushi-primary/15 flex items-center justify-center mt-0.5">
                <Bot size={16} className="text-blue-600 dark:text-mushi-primary" />
              </div>
              <div className="rounded-xl bg-slate-100 dark:bg-gray-800 px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
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
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={configured ? 'Describe bugs or ask to create a session...' : 'Configure AI provider in Settings first'}
              disabled={!configured}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || !configured || sending}
              className="rounded-full bg-blue-500 p-2.5 text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default shrink-0"
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
