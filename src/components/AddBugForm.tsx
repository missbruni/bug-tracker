import React from 'react'
import { Paperclip } from 'lucide-react'
import { SEVERITIES, SEVERITY_STYLES, PAGES } from '../constants'
import { COMMON_TESTER_DEVICES } from '../lib/testerDevices'
import AttachmentCard from './AttachmentCard'
import { filesToAttachments, getImageFilesFromPaste } from '../lib/attachments'
import type { Severity } from '../constants'
import type { Attachment, SessionOption, Tester } from '../types'

const ADD_NEW_TESTER_VALUE = '__add_new_tester__'

interface NewBugPayload {
  id: string
  title: string
  description: string
  severity: Severity
  tester: string
  tester_id: string
  device: string
  page: string
  category: string | null
  session_id: string | null
  comments: never[]
  attachments: Attachment[]
}

interface AddBugFormProps {
  onAdd: (bug: NewBugPayload) => Promise<void> | void
  onAddTester: (name: string, devices?: string[]) => Promise<Pick<Tester, 'id' | 'name'> | null>
  onCancel: () => void
  nextIds: Record<Severity, number>
  testers: Array<Pick<Tester, 'id' | 'name'>>
  sessions?: SessionOption[]
  activeSessionId?: string | null
  variant?: 'card' | 'sheet'
}

export default function AddBugForm({ onAdd, onAddTester, onCancel, nextIds, testers, sessions = [], activeSessionId = null, variant = 'card' }: AddBugFormProps) {
  const [title, setTitle] = React.useState('')
  const [desc, setDesc] = React.useState('')
  const [severity, setSeverity] = React.useState<Severity>('high')
  const [selectedTesterId, setSelectedTesterId] = React.useState(() => localStorage.getItem('lastTesterId') || '')
  const [newTesterName, setNewTesterName] = React.useState('')
  const [newTesterDevices, setNewTesterDevices] = React.useState<string[]>([])
  const [device, setDevice] = React.useState('')
  const [page, setPage] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [sessionId, setSessionId] = React.useState<string | null>(activeSessionId)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [files, setFiles] = React.useState<Attachment[]>([])

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || [])
    if (newFiles.length) setFiles((prev) => [...prev, ...filesToAttachments(newFiles)])
    event.target.value = ''
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const imageFiles = getImageFilesFromPaste(event)
    if (imageFiles.length) {
      event.preventDefault()
      setFiles((prev) => [...prev, ...filesToAttachments(imageFiles)])
    }
  }

  const [submitting, setSubmitting] = React.useState(false)

  const toggleNewTesterDevice = (deviceName: string) => {
    setNewTesterDevices(prev => prev.includes(deviceName)
      ? prev.filter(d => d !== deviceName)
      : [...prev, deviceName])
  }

  const selectedTesterExists = testers.some((t) => t.id === selectedTesterId)
  const canSubmit = !!title.trim() && (
    (selectedTesterId === ADD_NEW_TESTER_VALUE && !!newTesterName.trim()) ||
    (selectedTesterId !== ADD_NEW_TESTER_VALUE && selectedTesterExists)
  )

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    const prefix = severity === 'critical' ? 'CRT' : severity === 'high' ? 'HI' : 'LO'
    const id = `${prefix}-${String(nextIds[severity]).padStart(2, '0')}`

    try {
      let selectedTester = testers.find(t => t.id === selectedTesterId) || null

      if (selectedTesterId === ADD_NEW_TESTER_VALUE) {
        const created = await onAddTester(newTesterName.trim(), newTesterDevices)
        if (!created) return
        selectedTester = created
        setSelectedTesterId(created.id)
        setNewTesterName('')
        setNewTesterDevices([])
      }

      if (!selectedTester) return
      localStorage.setItem('lastTesterId', selectedTester.id)
      localStorage.setItem('lastTesterName', selectedTester.name)

      await onAdd({
        id,
        title,
        description: desc,
        severity,
        tester: selectedTester.name,
        tester_id: selectedTester.id,
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
    <div className={variant === 'card' ? 'mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5' : ''} onPaste={handlePaste}>
      <h3 className="text-base font-bold text-slate-900 dark:text-gray-100 mb-3.5">Add New Bug</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bug title *"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        <select value={selectedTesterId} onChange={(event) => setSelectedTesterId(event.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 transition-all">
          <option value="" disabled hidden>Tester *</option>
          <option value={ADD_NEW_TESTER_VALUE}>+ Add new tester</option>
          {testers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {selectedTesterId === ADD_NEW_TESTER_VALUE && (
          <div className="col-span-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/10 p-2.5">
            <input value={newTesterName} onChange={(event) => setNewTesterName(event.target.value)} placeholder="New tester name *"
              className="w-full rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">Tester Devices (optional):</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TESTER_DEVICES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleNewTesterDevice(d)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                    newTesterDevices.includes(d)
                      ? 'bg-blue-500 text-white dark:text-mushi-bg border-blue-500'
                      : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <input value={device} onChange={(event) => setDevice(event.target.value)} placeholder="Device / Browser"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        <select value={page} onChange={(event) => setPage(event.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 transition-all">
          <option value="" disabled hidden>Page</option>
          {PAGES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category (optional)"
          className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all" />
        {sessions.length > 0 && (
          <select
            value={sessionId || ''}
            onChange={(event) => setSessionId(event.target.value || null)}
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
      <textarea value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="Description" rows={3}
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
        <button onClick={submit} disabled={!canSubmit || submitting}
          className={`rounded-md px-5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default ${canSubmit && !submitting ? 'bg-blue-500 text-white dark:text-mushi-bg hover:bg-blue-600' : 'bg-slate-400 text-white'}`}>
          {submitting ? 'Adding…' : 'Add Bug'}
        </button>
      </div>
    </div>
  )
}
