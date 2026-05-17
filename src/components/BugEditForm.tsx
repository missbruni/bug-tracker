import { useState } from 'react'
import { SEVERITY_STYLES } from '../constants'
import type { Severity } from '../constants'

interface EditFields {
  title: string
  description: string
  severity: Severity
  tester: string
  device: string
  page: string
  category: string
}

interface BugEditFormProps {
  initial: EditFields
  onSave: (fields: EditFields) => Promise<boolean>
  onCancel: () => void
}

export default function BugEditForm({ initial, onSave, onCancel }: BugEditFormProps) {
  const [fields, setFields] = useState<EditFields>(initial)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!fields.title.trim() || saving) return
    setSaving(true)
    const ok = await onSave(fields)
    if (!ok) setSaving(false)
  }

  return (
    <div className="mb-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={fields.title} onChange={e => setFields(f => ({ ...f, title: e.target.value }))} placeholder="Title *" className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500" />
        <input value={fields.tester} onChange={e => setFields(f => ({ ...f, tester: e.target.value }))} placeholder="Tester" className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500" />
        <input value={fields.device} onChange={e => setFields(f => ({ ...f, device: e.target.value }))} placeholder="Device" className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500" />
        <input value={fields.page} onChange={e => setFields(f => ({ ...f, page: e.target.value }))} placeholder="Page" className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500" />
        <input value={fields.category} onChange={e => setFields(f => ({ ...f, category: e.target.value }))} placeholder="Category" className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500" />
        <div className="flex items-center gap-1.5">
          {(['critical', 'high', 'low'] as Severity[]).map(s => (
            <button key={s} onClick={() => setFields(f => ({ ...f, severity: s }))} className="rounded-full px-3 py-1 text-xs font-bold uppercase text-white cursor-pointer transition-opacity" style={{ background: SEVERITY_STYLES.dark[s].badge, opacity: s === fields.severity ? 1 : 0.35 }}>{s}</button>
          ))}
        </div>
      </div>
      <textarea value={fields.description} onChange={e => setFields(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y focus:border-blue-400 dark:focus:border-blue-500" />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!fields.title.trim() || saving}
          className="rounded-md bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </button>
        <button onClick={onCancel} className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">Cancel</button>
      </div>
    </div>
  )
}
