import { useState, useRef } from 'react'
import { Check, Pencil, Loader2, Paperclip } from 'lucide-react'
import { SEVERITIES, SEVERITY_STYLES, PAGES } from '../constants'
import { getImageFilesFromPaste } from '../lib/attachments'
import AttachmentCard from './AttachmentCard'
import type { ParsedBug, BugPreview } from '../lib/aiTypes'

export default function AiBugPreviewCard({
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
      <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-green-200 dark:border-green-800/50 px-3.5 py-2">
          <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Bug Created</span>
          {bug._createdId && (
            <span className="rounded bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300">
              {bug._createdId}
            </span>
          )}
        </div>

        <div className="px-3.5 py-2.5">
          <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1.5">{bug.title}</p>
          <p className="text-[11px] text-green-700 dark:text-green-400 leading-relaxed">{bug.description}</p>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2 text-[10px] text-green-700/90 dark:text-green-400/90">
            {bug.tester !== '\u2014' && <span>{bug.tester}</span>}
            <span>{bug.device}</span>
            {bug.page !== '\u2014' && <span>{bug.page}</span>}
            {bug.category && <span>{bug.category}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-xs" onPaste={handlePaste}>
      {/* Header — severity badge + title + edit toggle */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shrink-0 leading-none"
          style={{ background: sevStyle.badge }}
        >
          {bug.severity}
        </span>
        <span className="flex-1 text-xs font-semibold text-slate-900 dark:text-gray-100 truncate">{bug.title}</span>
        <button
          onClick={() => setEditing(!editing)}
          className={`shrink-0 cursor-pointer transition-colors ${editing ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300'}`}
          title={editing ? 'Done editing' : 'Edit'}
        >
          <Pencil size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 pb-2">
        {editing ? (
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-gray-700/50">
            <textarea
              value={bug.description}
              onChange={(e) => onUpdate('description', e.target.value)}
              rows={2}
              className="w-full text-[11px] text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 outline-none border border-slate-300 dark:border-gray-600 rounded px-2 py-1 mt-1.5 resize-none focus:border-blue-500"
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={bug.severity}
                onChange={(e) => onUpdate('severity', e.target.value)}
                className="text-[11px] text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <input
                value={bug.tester}
                onChange={(e) => onUpdate('tester', e.target.value)}
                className="text-[11px] text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 outline-none border border-slate-300 dark:border-gray-600 rounded px-2 py-1 focus:border-blue-500"
                placeholder="Tester"
              />
              <input
                value={bug.device}
                onChange={(e) => onUpdate('device', e.target.value)}
                className="text-[11px] text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 outline-none border border-slate-300 dark:border-gray-600 rounded px-2 py-1 focus:border-blue-500"
                placeholder="Device"
              />
              <select
                value={bug.page}
                onChange={(e) => onUpdate('page', e.target.value)}
                className="text-[11px] text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-500"
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
              className="w-full text-[11px] text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 outline-none border border-slate-300 dark:border-gray-600 rounded px-2 py-1 focus:border-blue-500"
              placeholder="Category (optional)"
            />
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-700 dark:text-gray-200 leading-relaxed line-clamp-2">{bug.description}</p>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5 text-[11px] text-slate-600 dark:text-gray-300">
              {bug.tester !== '\u2014' && <span>{bug.tester}</span>}
              <span>{bug.device}</span>
              {bug.page !== '\u2014' && <span>{bug.page}</span>}
              {bug.category && <span className="text-slate-500 dark:text-gray-400">{bug.category}</span>}
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
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-gray-700/50 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:text-gray-300 dark:hover:text-gray-100 transition-colors cursor-pointer shrink-0"
        >
          <Paperclip size={11} />
          Attach
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
        {attachments.length === 0 && (
          <div className="flex-1 border border-dashed border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-[10px] text-slate-500 dark:text-gray-300 text-center truncate bg-white/70 dark:bg-transparent">
            or paste screenshot here
          </div>
        )}
        {attachments.length > 0 && <div className="flex-1" />}
        <button
          onClick={onCreate}
          disabled={bug._creating}
          className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white dark:text-mushi-bg hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
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
