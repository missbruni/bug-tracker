import React from 'react'
import {
  Plus,
  Pencil,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  MessageSquare,
  Rocket,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useBugActivity } from '../hooks/useBugActivity'

export type BugActivityAction =
  | 'created'
  | 'edited'
  | 'severity_changed'
  | 'reviewed'
  | 'reopened'
  | 'comment_added'
  | 'published'

export interface BugActivity {
  id: number
  bug_id: string
  team_id?: string
  action: BugActivityAction
  description: string
  actor: string | null
  created_at: string
}

const ACTION_CONFIG: Record<BugActivityAction, { icon: React.ReactNode; color: string }> = {
  created: { icon: <Plus size={12} />, color: 'text-blue-500 dark:text-blue-400' },
  edited: { icon: <Pencil size={12} />, color: 'text-slate-500 dark:text-gray-400' },
  severity_changed: { icon: <AlertTriangle size={12} />, color: 'text-amber-500 dark:text-amber-400' },
  reviewed: { icon: <CheckCircle size={12} />, color: 'text-green-500 dark:text-green-400' },
  reopened: { icon: <RotateCcw size={12} />, color: 'text-orange-500 dark:text-orange-400' },
  comment_added: { icon: <MessageSquare size={12} />, color: 'text-indigo-500 dark:text-indigo-400' },
  published: { icon: <Rocket size={12} />, color: 'text-teal-500 dark:text-teal-400' },
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface BugActivityTimelineProps {
  bugId: string
}

const COLLAPSED_LIMIT = 3

export default function BugActivityTimeline({ bugId }: BugActivityTimelineProps) {
  const { activities, loading } = useBugActivity(bugId)
  const [expanded, setExpanded] = React.useState(false)

  const visibleActivities = expanded ? activities : activities.slice(0, COLLAPSED_LIMIT)
  const hiddenCount = activities.length - COLLAPSED_LIMIT

  if (loading) {
    return (
      <div className="py-2">
        <div className="h-3 w-32 rounded bg-slate-200 dark:bg-gray-700 animate-pulse" />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">
          Activity
        </p>
        <p className="text-[11px] text-slate-400 dark:text-gray-600 italic">
          No activity recorded yet. Changes to this bug will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">
        Activity
      </p>
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-gray-700" />

        {visibleActivities.map((entry) => {
          const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.edited
          return (
            <div key={entry.id} className="relative flex items-start gap-2.5 py-1">
              <span className={`relative z-10 mt-0.5 shrink-0 rounded-full bg-white dark:bg-gray-900 p-0.5 ${config.color}`}>
                {config.icon}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-700 dark:text-gray-300">
                  {entry.description}
                </span>
                <span className="ml-2 text-[10px] text-slate-400 dark:text-gray-500 whitespace-nowrap">
                  {entry.actor && <>{entry.actor} &middot; </>}
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          {expanded ? (
            <><ChevronUp size={12} /> Show less</>
          ) : (
            <><ChevronDown size={12} /> Show {hiddenCount} more</>
          )}
        </button>
      )}
    </div>
  )
}
