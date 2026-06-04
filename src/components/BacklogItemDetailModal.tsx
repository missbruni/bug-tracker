import React from 'react'
import { Archive, CheckCircle, Upload, X } from 'lucide-react'
import BacklogSelectField from './BacklogSelectField'
import { PRIORITY_LABELS, PRIORITY_STYLES, TYPE_LABELS } from '../domains/backlog/display'
import type { BacklogColumn, BacklogItem, BacklogItemUpdate, BacklogMilestone, BacklogProduct, BacklogTeamMember } from '../domains/backlog/model'

export default function BacklogItemDetailModal({
  item,
  columns,
  products,
  milestones,
  members,
  childItems,
  canArchive,
  onClose,
  onUpdate,
  onArchive,
  onComment,
  onUpload,
  onDeleteAttachment,
  onMoveParentDone,
}: {
  item: BacklogItem
  columns: BacklogColumn[]
  products: BacklogProduct[]
  milestones: BacklogMilestone[]
  members: BacklogTeamMember[]
  childItems: BacklogItem[]
  canArchive: boolean
  onClose: () => void
  onUpdate: (updates: BacklogItemUpdate) => Promise<void>
  onArchive: () => Promise<void>
  onComment: (text: string) => Promise<void>
  onUpload: (files: File[]) => Promise<void>
  onDeleteAttachment: (attachmentId: number) => Promise<void>
  onMoveParentDone: () => Promise<void>
}) {
  const [comment, setComment] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const doneColumns = columns.filter((column) => column.is_done)
  const childDoneCount = childItems.filter((child) => doneColumns.some((column) => column.id === child.column_id)).length
  const allChildrenDone = childItems.length > 0 && childDoneCount === childItems.length && !doneColumns.some((column) => column.id === item.column_id)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setUploading(true)
    await onUpload(files)
    setUploading(false)
  }

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = Array.from(event.clipboardData?.items || [])
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item, index) => {
        const file = item.getAsFile()
        if (!file) return null
        const ext = file.type.split('/')[1] || 'png'
        return new File([file], `pasted-image-${Date.now()}-${index}.${ext}`, { type: file.type })
      })
      .filter((file): file is File => file !== null)

    if (!imageFiles.length) return
    event.preventDefault()
    setUploading(true)
    await onUpload(imageFiles)
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-60 flex items-stretch justify-end" role="dialog" aria-modal="true" aria-label={item.title}>
      <button className="absolute inset-0 bg-black/40 cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-slate-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-gray-800 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 dark:text-gray-500">{item.display_id}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[item.priority]}`}>{PRIORITY_LABELS[item.priority]}</span>
              <span className="rounded-full border border-slate-200 dark:border-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:text-gray-400">{TYPE_LABELS[item.type]}</span>
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-gray-100 font-heading">{item.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" onPaste={handlePaste}>
          <div className="grid gap-3 sm:grid-cols-2">
            <BacklogSelectField label="Column" value={item.column_id || ''} onChange={(value) => { void onUpdate({ column_id: value || null }) }} options={columns.map((column) => ({ value: column.id, label: column.name }))} />
            <BacklogSelectField label="Assignee" value={item.assignee_user_id || ''} onChange={(value) => { void onUpdate({ assignee_user_id: value || null }) }} options={[{ value: '', label: 'Unassigned' }, ...members.map((member) => ({ value: member.id, label: member.display_name }))]} />
            <BacklogSelectField label="Product" value={item.product_id || ''} onChange={(value) => { void onUpdate({ product_id: value || null }) }} options={[{ value: '', label: 'No product' }, ...products.map((product) => ({ value: product.id, label: product.name }))]} />
            <BacklogSelectField label="Milestone" value={item.milestone_id || ''} onChange={(value) => { void onUpdate({ milestone_id: value || null }) }} options={[{ value: '', label: 'No milestone' }, ...milestones.map((milestone) => ({ value: milestone.id, label: milestone.name }))]} />
          </div>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">Description</h3>
            <p className="whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 px-3 py-3 text-sm text-slate-700 dark:text-gray-300">
              {item.description || 'No description yet.'}
            </p>
          </section>

          {childItems.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">Child Tasks</h3>
                <span className="text-xs text-slate-500 dark:text-gray-400">{childDoneCount}/{childItems.length} done</span>
              </div>
              <div className="space-y-2">
                {childItems.map((child) => (
                  <div key={child.id} className="rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm text-slate-700 dark:text-gray-300">
                    <span className="mr-2 text-xs font-bold text-slate-400">{child.display_id}</span>
                    {child.title}
                  </div>
                ))}
              </div>
              {allChildrenDone && (
                <button onClick={() => { void onMoveParentDone() }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-teal-500 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 dark:border-mushi-primary dark:bg-mushi-primary/10 dark:text-mushi-primary dark:hover:bg-mushi-primary/20 cursor-pointer">
                  <CheckCircle size={14} />
                  Move parent to Done
                </button>
              )}
            </section>
          )}

          {item.linked_bugs.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">Linked Bugs</h3>
              <div className="space-y-2">
                {item.linked_bugs.map((bug) => (
                  <a key={bug.id} href={`/?q=${bug.id}`} className="block rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm hover:border-blue-300 dark:hover:border-mushi-primary/50 transition-colors">
                    <span className="mr-2 text-xs font-bold text-slate-400">{bug.id}</span>
                    <span className="text-slate-800 dark:text-gray-200">{bug.title}</span>
                    {bug.reviewed && <span className="ml-2 text-[10px] font-bold text-teal-600 dark:text-mushi-primary">DONE</span>}
                  </a>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">Attachments</h3>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer">
                <Upload size={12} />
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => { void handleUpload(event) }} />
            </div>
            <div className="space-y-2">
              {item.attachments.length === 0 && <p className="text-sm text-slate-400 dark:text-gray-500">No attachments yet.</p>}
              {item.attachments.map((attachment) => (
                <div key={attachment.id || attachment.url} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2">
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-blue-600 dark:text-mushi-primary">{attachment.name}</a>
                  {attachment.id && (
                    <button onClick={() => { void onDeleteAttachment(attachment.id!) }} className="text-xs font-semibold text-slate-400 hover:text-red-500 cursor-pointer">Remove</button>
                  )}
                </div>
              ))}
              <div className="flex min-h-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 px-3 text-center text-[11px] leading-tight text-slate-400 dark:text-gray-500">
                <span>
                  Paste image
                  <br />
                  to attach
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">Comments</h3>
            <div className="space-y-2">
              {item.comments.map((itemComment) => (
                <div key={itemComment.id || itemComment.created_at} className="rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2">
                  <p className="text-sm text-slate-700 dark:text-gray-300">{itemComment.text}</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">{itemComment.author || 'Someone'} {itemComment.created_at ? `· ${new Date(itemComment.created_at).toLocaleString()}` : ''}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 outline-none focus:border-blue-400" />
                <button
                  onClick={async () => {
                    if (!comment.trim()) return
                    await onComment(comment)
                    setComment('')
                  }}
                  disabled={!comment.trim()}
                  className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 dark:border-gray-800 px-5 py-4">
          {canArchive ? (
            <button onClick={() => { void onArchive() }} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer">
              <Archive size={13} />
              Archive
            </button>
          ) : <span />}
          <button onClick={onClose} className="rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  )
}
