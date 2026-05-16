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
