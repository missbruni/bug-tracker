import React from 'react'
import { X } from 'lucide-react'
import BacklogSelectField from './BacklogSelectField'
import { BACKLOG_PRIORITIES } from '../domains/backlog/helpers'
import { ITEM_TYPES, PRIORITY_LABELS, TYPE_LABELS } from '../domains/backlog/display'
import type { BacklogColumn, BacklogItem, BacklogItemType, BacklogMilestone, BacklogPriority, BacklogProduct, BacklogTeamMember, NewBacklogItemInput } from '../domains/backlog/model'

export default function NewBacklogItemModal({
  columns,
  products,
  milestones,
  members,
  parentItems,
  defaultColumnId,
  defaultParentId,
  onClose,
  onCreate,
}: {
  columns: BacklogColumn[]
  products: BacklogProduct[]
  milestones: BacklogMilestone[]
  members: BacklogTeamMember[]
  parentItems: BacklogItem[]
  defaultColumnId?: string | null
  defaultParentId?: string | null
  onClose: () => void
  onCreate: (input: NewBacklogItemInput) => Promise<void>
}) {
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [type, setType] = React.useState<BacklogItemType>(defaultParentId ? 'task' : 'feature')
  const [priority, setPriority] = React.useState<BacklogPriority>('medium')
  const [columnId, setColumnId] = React.useState(defaultColumnId || columns[0]?.id || '')
  const [productId, setProductId] = React.useState('')
  const [parentId, setParentId] = React.useState(defaultParentId || '')
  const [milestoneId, setMilestoneId] = React.useState('')
  const [assigneeId, setAssigneeId] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    await onCreate({
      title,
      description,
      type,
      priority,
      column_id: columnId || null,
      product_id: productId || null,
      parent_item_id: parentId || null,
      milestone_id: milestoneId || null,
      assignee_user_id: assigneeId || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="New backlog item">
      <button className="absolute inset-0 bg-black/40 cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase">New Backlog Item</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">Capture work for this team board.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-semibold text-slate-700 dark:text-gray-300">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save() }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 outline-none focus:border-blue-400"
              autoFocus
            />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold text-slate-700 dark:text-gray-300">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 outline-none focus:border-blue-400"
            />
          </label>
          <BacklogSelectField label="Type" value={type} onChange={(value) => setType(value as BacklogItemType)} options={ITEM_TYPES.map((itemType) => ({ value: itemType, label: TYPE_LABELS[itemType] }))} />
          <BacklogSelectField label="Priority" value={priority} onChange={(value) => setPriority(value as BacklogPriority)} options={BACKLOG_PRIORITIES.map((itemPriority) => ({ value: itemPriority, label: PRIORITY_LABELS[itemPriority] }))} />
          <BacklogSelectField label="Column" value={columnId} onChange={setColumnId} options={columns.map((column) => ({ value: column.id, label: column.name }))} />
          <BacklogSelectField label="Product" value={productId} onChange={setProductId} options={[{ value: '', label: 'No product' }, ...products.map((product) => ({ value: product.id, label: product.name }))]} />
          <BacklogSelectField label="Parent" value={parentId} onChange={setParentId} options={[{ value: '', label: 'No parent' }, ...parentItems.map((item) => ({ value: item.id, label: `${item.display_id} ${item.title}` }))]} />
          <BacklogSelectField label="Milestone" value={milestoneId} onChange={setMilestoneId} options={[{ value: '', label: 'No milestone' }, ...milestones.map((milestone) => ({ value: milestone.id, label: milestone.name }))]} />
          <BacklogSelectField label="Assignee" value={assigneeId} onChange={setAssigneeId} options={[{ value: '', label: 'Unassigned' }, ...members.map((member) => ({ value: member.id, label: member.display_name }))]} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-gray-800 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer">Cancel</button>
          <button onClick={() => void save()} disabled={!title.trim() || saving} className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:opacity-50 cursor-pointer disabled:cursor-default">
            {saving ? 'Creating...' : 'Create item'}
          </button>
        </div>
      </div>
    </div>
  )
}
