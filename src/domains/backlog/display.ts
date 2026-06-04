import type { BacklogItem, BacklogItemType, BacklogPriority, BacklogTeamMember } from './model'

export const ITEM_TYPES: BacklogItemType[] = ['bug', 'feature', 'task', 'chore']

export const TYPE_LABELS: Record<BacklogItemType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  task: 'Task',
  chore: 'Chore',
}

export const PRIORITY_LABELS: Record<BacklogPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_STYLES: Record<BacklogPriority, string> = {
  urgent: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/30',
  high: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-mushi-primary/10 dark:text-mushi-primary dark:border-mushi-primary/30',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  low: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
}

export function getItemAssigneeName(item: BacklogItem, members: BacklogTeamMember[]): string {
  if (!item.assignee_user_id) return 'Unassigned'
  return members.find((member) => member.id === item.assignee_user_id)?.display_name || 'Unknown'
}
