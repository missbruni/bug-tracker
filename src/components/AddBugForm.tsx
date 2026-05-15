import { useState, useRef } from 'react'
import { Paperclip } from 'lucide-react'
import { SEVERITIES, SEVERITY_STYLES, PAGES } from '../constants'
import AttachmentCard from './AttachmentCard'
import { filesToAttachments, getImageFilesFromPaste } from '../lib/attachments'
import type { Severity } from '../constants'
import type { Attachment, SessionOption } from '../types'

interface NewBugPayload {
  id: string
  title: string
  description: string
  severity: Severity
  tester: string
  device: string
  page: string
  category: string | null
  session_id: string | null
  comments: never[]
  attachments: Attachment[]
}

interface AddBugFormProps {
  onAdd: (bug: NewBugPayload) => Promise<void> | void
  onCancel: () => void
  nextIds: Record<Severity, number>
  sessions?: SessionOption[]
  activeSessionId?: string | null
}

export default function AddBugForm({ onAdd, onCancel, nextIds, sessions = [], activeSessionId = null }: AddBugFormProps) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [severity, setSeverity] = useState<Severity>('high')
  const [tester, setTester] = useState(() => localStorage.getItem('lastTester') || '')
  const [device, setDevice] = useState('')
  const [page, setPage] = useState('')
  const [category, setCategory] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(activeSessionId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<Attachment[]>([])

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (newFiles.length) setFiles((prev) => [...prev, ...filesToAttachments(newFiles)])
    e.target.value = ''
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const imageFiles = getImageFilesFromPaste(e)
    if (imageFiles.length) {
      e.preventDefault()
      setFiles((prev) => [...prev, ...filesToAttachments(imageFiles)])
    }
  }

  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    const prefix = severity === 'critical' ? 'CRT' : severity === 'high' ? 'HI' : 'LO'
    const id = `${prefix}-${String(nextIds[severity]).padStart(2, '0')}`
    if (tester.trim()) localStorage.setItem('lastTester', tester.trim())
    try {
      await onAdd({
        id,
        title,
        description: desc,
        severity,
        tester: tester || 'Unknown',
        device: device || '\u2014',
        page: page || '\u2014',
        category: category || null,
        session_id: sessionId || null,
        comments: [],
        attachments: files,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5" onPaste={handlePaste}>
      <h3 className="text-base font-bold text-slate-900 dark:text-gray-100 mb-3.5">Add New Bug</h3>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bug title *"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        <input value={tester} onChange={(e) => setTester(e.target.value)} placeholder="Tester name"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        <input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Device / Browser"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        <select value={page} onChange={(e) => setPage(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 transition-all">
          <option value="" disabled hidden>Page</option>
          {PAGES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        {sessions.length > 0 && (
          <select
            value={sessionId || ''}
            onChange={(e) => setSessionId(e.target.value || null)}
            className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 transition-all"
          >
            <option value="">No session</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (active)' : ''}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-gray-400">Severity:</span>
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => setSeverity(s)}
              className="rounded-full px-3 py-1 text-xs font-bold uppercase text-white cursor-pointer transition-opacity"
              style={{ background: SEVERITY_STYLES.dark[s].badge, opacity: s === severity ? 1 : 0.35 }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={3}
        className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y mb-2.5 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {files.map((att, i) => (
            <AttachmentCard key={i} att={att} onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <Paperclip size={12} />Attach files
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={handleFiles} className="hidden" />
        <div className="flex-1" />
        <button onClick={onCancel}
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          Cancel
        </button>
        <button onClick={submit} disabled={!title.trim() || submitting}
          className="rounded-md px-5 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:cursor-default"
          style={{ background: title.trim() && !submitting ? '#3b82f6' : '#94a3b8' }}>
          {submitting ? 'Adding…' : 'Add Bug'}
        </button>
      </div>
    </div>
  )
}
