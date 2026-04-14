import { useState, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Paperclip,
  MessageSquare,
  Trash2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { N8N_WEBHOOK_URL, SEVERITY_STYLES } from '../constants'
import { TesterBadge } from './TesterBadge'
import AttachmentCard, { type Attachment } from './AttachmentCard'
import type { Severity } from '../constants'

export interface Comment {
  id?: number
  bug_id?: string
  text: string
  time?: string
}

export interface Bug {
  id: string
  title: string
  description: string
  severity: Severity
  tester: string
  device: string
  page: string
  category: string | null
  created_at?: string
  reviewed?: boolean
  backlog_url?: string | null
  comments: Comment[]
  attachments: Attachment[]
}

function playTickSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(1800, ctx.currentTime)
    osc.frequency.setValueAtTime(2400, ctx.currentTime + 0.04)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch { /* ignore audio errors */ }
}

interface BugCardProps {
  bug: Bug
  onUpdate: (bug: Bug) => void
  onImageClick: (src: string, alt: string, type: string) => void
  onDelete: (bugId: string) => void
}

export default function BugCard({ bug, onUpdate, onImageClick, onDelete }: BugCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [backlogUrl, setBacklogUrl] = useState<string | null>(bug.backlog_url || null)
  const fileRef = useRef<HTMLInputElement>(null)
  const style = SEVERITY_STYLES.dark[bug.severity]

  const publishToBacklog = async () => {
    setPublishing(true)
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bug.id,
          title: bug.title,
          description: bug.description || '',
          severity: bug.severity,
          tester: bug.tester,
          page: bug.page,
          device: bug.device,
          category: bug.category || '',
          attachments: bug.attachments.map((a) => ({ name: a.name, url: a.url, type: a.type })),
        }),
      })
      const data = await res.json()
      if (data.success) {
        const url = data.url || null
        setBacklogUrl(url)
        if (url) window.open(url, '_blank')
        if (supabase) {
          const updates: Record<string, unknown> = { backlog_url: url }
          if (!bug.reviewed) updates.reviewed = true
          await supabase.from('bugs').update(updates).eq('id', bug.id)
        }
        onUpdate({ ...bug, backlog_url: url, reviewed: true })
      } else {
        alert('Failed to publish: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Publish to backlog failed:', err)
      alert('Failed to publish to backlog. Check console for details.')
    }
    setPublishing(false)
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    const newComment = { text: commentText.trim(), time: 'Just now' }

    if (supabase) {
      const { data, error } = await supabase
        .from('comments')
        .insert({ bug_id: bug.id, text: newComment.text, time: newComment.time })
        .select()
      if (!error && data?.[0]) {
        onUpdate({ ...bug, comments: [...bug.comments, { ...newComment, id: data[0].id }] })
      }
    } else {
      onUpdate({ ...bug, comments: [...bug.comments, newComment] })
    }
    setCommentText('')
    setShowCommentInput(false)
  }

  const deleteComment = async (comment: { id?: number }, index: number) => {
    if (supabase && comment.id) {
      const { error } = await supabase.from('comments').delete().eq('id', comment.id)
      if (error) { console.error('Failed to delete comment:', error); return }
    }
    onUpdate({ ...bug, comments: bug.comments.filter((_, i) => i !== index) })
  }

  const deleteAttachment = async (attachment: { id?: number; url?: string }, index: number) => {
    if (supabase && attachment.id) {
      const { error } = await supabase.from('attachments').delete().eq('id', attachment.id)
      if (error) { console.error('Failed to delete attachment:', error); return }
      if (attachment.url) {
        const path = attachment.url.split('/attachments/')[1]
        if (path) await supabase.storage.from('attachments').remove([decodeURIComponent(path)])
      }
    }
    onUpdate({ ...bug, attachments: bug.attachments.filter((_, i) => i !== index) })
  }

  const toggleReviewed = async () => {
    const newVal = !bug.reviewed
    if (newVal) playTickSound()
    if (supabase) {
      const { error } = await supabase.from('bugs').update({ reviewed: newVal }).eq('id', bug.id)
      if (error) { console.error('Failed to toggle reviewed:', error); return }
    }
    onUpdate({ ...bug, reviewed: newVal })
  }

  const deleteBug = async () => {
    if (!window.confirm(`Delete bug ${bug.id}? This cannot be undone.`)) return

    if (supabase) {
      const storagePaths = bug.attachments
        .map((att) => att.url?.split('/attachments/')[1])
        .filter(Boolean)
        .map((path) => decodeURIComponent(path!))

      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from('attachments').remove(storagePaths)
        if (storageError) console.error('Failed to delete attachment files:', storageError)
      }

      const { error: commentsError } = await supabase.from('comments').delete().eq('bug_id', bug.id)
      if (commentsError) { console.error('Failed to delete bug comments:', commentsError); return }

      const { error: attachmentsError } = await supabase.from('attachments').delete().eq('bug_id', bug.id)
      if (attachmentsError) { console.error('Failed to delete bug attachments:', attachmentsError); return }

      const { error: bugError } = await supabase.from('bugs').delete().eq('id', bug.id)
      if (bugError) { console.error('Failed to delete bug:', bugError); return }
    }

    onDelete(bug.id)
  }

  const uploadFiles = async (files: File[]) => {
    const newAttachments: Bug['attachments'] = []
    for (const file of files) {
      if (supabase) {
        const path = `${bug.id}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('attachments').upload(path, file)
        if (!error) {
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
          const { data: row } = await supabase
            .from('attachments')
            .insert({ bug_id: bug.id, name: file.name, url: urlData.publicUrl, type: file.type })
            .select()
          if (row?.[0]) newAttachments.push(row[0])
        }
      } else {
        newAttachments.push({ name: file.name, url: URL.createObjectURL(file), type: file.type })
      }
    }
    if (newAttachments.length) {
      onUpdate({ ...bug, attachments: [...bug.attachments, ...newAttachments] })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    await uploadFiles(files)
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => {
        const file = item.getAsFile()
        if (file) {
          const ext = file.type.split('/')[1] || 'png'
          return new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type })
        }
        return null
      })
      .filter((f): f is File => f !== null)
    if (imageFiles.length) {
      e.preventDefault()
      await uploadFiles(imageFiles)
    }
  }

  return (
    <div
      className={`group mb-2 rounded-lg border border-slate-200 dark:border-gray-700 transition-shadow hover:shadow-sm dark:hover:shadow-md dark:hover:shadow-black/20 ${bug.reviewed ? 'bg-slate-50/60 dark:bg-gray-900/60 opacity-60' : 'bg-white dark:bg-gray-900'}`}
      style={{ borderLeft: `4px solid ${bug.reviewed ? '#94a3b8' : style.badge}` }}
    >
      <div className="flex items-center">
        <button
          onClick={toggleReviewed}
          className={`shrink-0 pl-4 pr-1 py-3 cursor-pointer transition-colors ${bug.reviewed ? 'text-green-500' : 'text-slate-300 dark:text-gray-600 hover:text-green-400'}`}
          title={bug.reviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
        >
          <CheckCircle size={18} />
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-3 px-2 py-3 text-left cursor-pointer min-w-0"
        >
          {expanded ? (
            <ChevronDown size={16} className="text-slate-400 dark:text-gray-500 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 dark:text-gray-500 shrink-0" />
          )}
          <span className={`text-xs font-bold text-slate-400 dark:text-gray-500 shrink-0 ${bug.reviewed ? 'line-through' : ''}`} style={{ minWidth: 48 }}>
            {bug.id}
          </span>
          <div className="flex-1 min-w-0">
            <span className={`block truncate text-sm font-medium ${bug.reviewed ? 'line-through text-slate-400 dark:text-gray-600' : 'text-slate-900 dark:text-gray-100'}`}>
              {bug.title}
            </span>
            <span className="block text-[11px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">
              {bug.page}{bug.category ? ` \u00b7 ${bug.category}` : ''}{bug.device ? ` \u00b7 ${bug.device}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            {bug.attachments.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
                <Paperclip size={12} />
                {bug.attachments.length}
              </span>
            )}
            {bug.comments.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
                <MessageSquare size={12} />
                {bug.comments.length}
              </span>
            )}
            <TesterBadge>{bug.tester}</TesterBadge>
            <button
              onClick={(e) => { e.stopPropagation(); deleteBug() }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-all cursor-pointer"
              title="Delete bug"
            >
              <Trash2 size={14} />
            </button>
            {backlogUrl && (
              <a
                href={backlogUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
              >
                <ExternalLink size={10} />
                View in Backlog
              </a>
            )}
          </div>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-gray-800 px-4 py-3" onPaste={handlePaste}>
          <p className="mb-3 text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{bug.description}</p>

          <div className="mb-3">
            {bug.attachments.length > 0 && (
              <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">Attachments</p>
            )}
            <div className="flex flex-wrap gap-3">
              {bug.attachments.map((att, i) => (
                <AttachmentCard key={att.id || i} att={att} onImageClick={onImageClick} onRemove={() => deleteAttachment(att, i)} />
              ))}
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 text-slate-400 dark:text-gray-500 text-[10px] text-center leading-tight px-2 cursor-default" style={{ width: 180, height: 140 }}>
                <span>Paste image<br />to attach</span>
              </div>
            </div>
          </div>

          {bug.comments.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">Comments</p>
              {bug.comments.map((c, i) => (
                <div
                  key={c.id || i}
                  className="group/comment mb-1.5 flex items-start gap-2 rounded-md bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-700 dark:text-gray-300"
                >
                  <span className="flex-1">
                    {c.text}
                    {c.time && (
                      <span className="ml-2 text-xs text-slate-400 dark:text-gray-500">({c.time})</span>
                    )}
                  </span>
                  <button
                    onClick={() => deleteComment(c, i)}
                    className="shrink-0 opacity-0 group-hover/comment:opacity-100 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity cursor-pointer"
                    title="Delete comment"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <Paperclip size={12} />
              Attach
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            {showCommentInput ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                  autoFocus
                />
                <button
                  onClick={addComment}
                  className="rounded-md bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCommentInput(true)}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <MessageSquare size={12} />
                Comment
              </button>
            )}
            <div className="flex-1" />
            {backlogUrl && (
              <a
                href={backlogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/40 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors"
              >
                <ExternalLink size={12} />
                View in Backlog
              </a>
            )}
            <button
              onClick={publishToBacklog}
              disabled={publishing}
              className="flex items-center gap-1.5 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50"
            >
              <ExternalLink size={12} />
              {publishing ? 'Publishing...' : backlogUrl ? 'Re-publish' : 'Publish to Backlog'}
            </button>
            <button
              onClick={deleteBug}
              className="flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              Delete Bug
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
