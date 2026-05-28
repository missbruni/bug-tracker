import React from 'react'
import {
  X,
  Plus,
  Pencil,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  MessageSquare,
  Rocket,
  UserPlus,
  UserMinus,
  Shield,
  Mail,
  Package,
  Building2,
  Activity,
} from 'lucide-react'
import { useTeamActivity, type TeamActivityAction, type UnifiedActivity } from '../hooks/useTeamActivity'
import type { BugActivityAction } from './BugActivityTimeline'

interface TeamActivityModalProps {
  teamId: string
  teamName: string
  onClose: () => void
}

const TEAM_ACTION_CONFIG: Record<TeamActivityAction, { icon: React.ReactNode; color: string }> = {
  team_created: { icon: <Building2 size={12} />, color: 'text-blue-500 dark:text-blue-400' },
  team_renamed: { icon: <Pencil size={12} />, color: 'text-slate-500 dark:text-gray-400' },
  member_added: { icon: <UserPlus size={12} />, color: 'text-green-500 dark:text-green-400' },
  member_removed: { icon: <UserMinus size={12} />, color: 'text-red-500 dark:text-red-400' },
  role_changed: { icon: <Shield size={12} />, color: 'text-amber-500 dark:text-amber-400' },
  member_status_changed: { icon: <Shield size={12} />, color: 'text-slate-500 dark:text-gray-400' },
  invitation_sent: { icon: <Mail size={12} />, color: 'text-indigo-500 dark:text-indigo-400' },
  invitation_cancelled: { icon: <Mail size={12} />, color: 'text-slate-400 dark:text-gray-500' },
  invitation_status_changed: { icon: <Mail size={12} />, color: 'text-slate-400 dark:text-gray-500' },
  product_added: { icon: <Package size={12} />, color: 'text-violet-500 dark:text-violet-400' },
  product_renamed: { icon: <Pencil size={12} />, color: 'text-slate-500 dark:text-gray-400' },
  product_updated: { icon: <Pencil size={12} />, color: 'text-slate-500 dark:text-gray-400' },
  product_removed: { icon: <Package size={12} />, color: 'text-red-500 dark:text-red-400' },
}

const BUG_ACTION_CONFIG: Record<BugActivityAction, { icon: React.ReactNode; color: string }> = {
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

function getEntryConfig(entry: UnifiedActivity) {
  if (entry.kind === 'team') {
    return TEAM_ACTION_CONFIG[entry.action] || TEAM_ACTION_CONFIG.team_renamed
  }
  return BUG_ACTION_CONFIG[entry.action] || BUG_ACTION_CONFIG.edited
}

function getEntryLabel(entry: UnifiedActivity): string {
  if (entry.kind === 'bug') return `Bug ${entry.bug_id}`
  return 'Team'
}

export default function TeamActivityModal({ teamId, teamName, onClose }: TeamActivityModalProps) {
  const { activities, loading } = useTeamActivity(teamId)

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" role="dialog" aria-modal="true" aria-label={`Activity for ${teamName}`}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close activity panel"
        className="absolute inset-0 bg-black/40 cursor-default"
      />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white dark:bg-gray-900 shadow-xl border-l border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-teal-600 dark:text-mushi-primary" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Activity</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-[260px]">{teamName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-4 w-full rounded bg-slate-200 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-gray-600 italic">
              No activity recorded yet. Changes to this team will appear here.
            </p>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-gray-700" />
              {activities.map((entry) => {
                const config = getEntryConfig(entry)
                const label = getEntryLabel(entry)
                const key = `${entry.kind}-${entry.id}`
                return (
                  <div key={key} className="relative flex items-start gap-2.5 py-1.5">
                    <span className={`relative z-10 mt-0.5 shrink-0 rounded-full bg-white dark:bg-gray-900 p-0.5 ${config.color}`}>
                      {config.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                          {label}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-gray-300">{entry.description}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500 whitespace-nowrap">
                        {entry.actor && <>{entry.actor} &middot; </>}
                        {formatRelativeTime(entry.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
