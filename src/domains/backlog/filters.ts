import { getItemAssigneeName } from './display'
import type { BacklogItem, BacklogTeamMember } from './model'

export interface BacklogFilters {
  search: string
  productId: string
  type: string
  assigneeId: string
}

export function itemMatchesFilters(item: BacklogItem, filters: BacklogFilters, members: BacklogTeamMember[]): boolean {
  if (filters.productId !== 'all' && item.product_id !== filters.productId) return false
  if (filters.type !== 'all' && item.type !== filters.type) return false
  if (filters.assigneeId === 'unassigned' && item.assignee_user_id) return false
  if (filters.assigneeId !== 'all' && filters.assigneeId !== 'unassigned' && item.assignee_user_id !== filters.assigneeId) return false

  const query = filters.search.trim().toLowerCase()
  if (!query) return true
  const assignee = getItemAssigneeName(item, members).toLowerCase()
  return [
    item.display_id,
    item.title,
    item.description || '',
    item.type,
    item.priority,
    assignee,
    ...item.linked_bugs.map((bug) => `${bug.id} ${bug.title}`),
  ].some((value) => value.toLowerCase().includes(query))
}
