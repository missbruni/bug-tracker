import React from 'react'
import { GitBranch, Paperclip } from 'lucide-react'
import { getItemAssigneeName, PRIORITY_LABELS, PRIORITY_STYLES, TYPE_LABELS } from '../domains/backlog/display'
import type { BacklogItem, BacklogTeamMember } from '../domains/backlog/model'

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
}

function AssigneeAvatar({ item, members }: { item: BacklogItem; members: BacklogTeamMember[] }) {
  const member = item.assignee_user_id ? members.find((teamMember) => teamMember.id === item.assignee_user_id) : null
  const label = member?.display_name || 'Unassigned'
  if (!member) {
    return (
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 text-[9px] font-bold text-slate-400 dark:text-gray-500" title={label}>
        —
      </span>
    )
  }
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={`${member.display_name} avatar`}
        className="h-5 w-5 shrink-0 rounded-full object-cover"
        referrerPolicy="no-referrer"
        title={member.display_name}
      />
    )
  }
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-gray-700 text-[9px] font-bold text-slate-700 dark:text-gray-200" title={member.display_name}>
      {getInitials(member.display_name)}
    </span>
  )
}

export default function BacklogCard({
  item,
  members,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  item: BacklogItem
  members: BacklogTeamMember[]
  onOpen: (item: BacklogItem) => void
  onDragStart: (itemId: string) => void
  onDragEnd: () => void
  onDropBefore: (beforeItemId: string) => void
}) {
  const childDoneCount = item.parent_item_id ? 0 : item.linked_bugs.filter((bug) => bug.reviewed).length
  const assigneeName = getItemAssigneeName(item, members)
  return (
    <button
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', item.id)
        onDragStart(item.id)
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDropBefore(item.id)
      }}
      onClick={() => onOpen(item)}
      className="w-full rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-left shadow-xs hover:border-blue-300 dark:hover:border-mushi-primary/50 transition-colors cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-gray-500">{item.display_id}</span>
            <span className="rounded-full border border-slate-200 dark:border-gray-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:text-gray-400">
              {TYPE_LABELS[item.type]}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-gray-100 line-clamp-2">{item.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[item.priority]}`}>
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-gray-500">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AssigneeAvatar item={item} members={members} />
          <span className="truncate">{assigneeName}</span>
        </span>
        {item.attachments.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip size={11} />
            {item.attachments.length}
          </span>
        )}
        {item.linked_bugs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-teal-600 dark:text-mushi-primary">
            <GitBranch size={11} />
            {item.linked_bugs.length} bug{item.linked_bugs.length === 1 ? '' : 's'}
          </span>
        )}
        {childDoneCount > 0 && <span>{childDoneCount} linked resolved</span>}
      </div>
    </button>
  )
}
