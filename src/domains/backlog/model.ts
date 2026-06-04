import type { Bug, Attachment } from '../bugs/model'

export type BacklogProvider = 'mushi' | 'azure'
export type BacklogItemType = 'bug' | 'feature' | 'task' | 'chore'
export type BacklogPriority = 'urgent' | 'high' | 'medium' | 'low'
export type BacklogMilestoneStatus = 'planned' | 'active' | 'completed' | 'archived'

export interface BacklogColumn {
  id: string
  team_id: string
  name: string
  sort_order: number
  is_done: boolean
  is_archived: boolean
  created_at?: string
  updated_at?: string
}

export interface BacklogMilestone {
  id: string
  team_id: string
  product_id?: string | null
  name: string
  start_date?: string | null
  target_date?: string | null
  status: BacklogMilestoneStatus
}

export interface BacklogProduct {
  id: string
  team_id: string
  name: string
  slug: string
}

export interface BacklogTeamMember {
  id: string
  email: string
  display_name: string
  avatar_url?: string | null
}

export interface BacklogComment {
  id?: number
  backlog_item_id: string
  team_id?: string
  text: string
  author?: string | null
  mentioned_user_ids?: string[]
  created_at?: string
}

export interface BacklogAttachment {
  id?: number
  backlog_item_id?: string
  team_id?: string
  name: string
  note?: string | null
  url: string
  type: string
  file?: File
  created_at?: string
}

export interface BacklogBugLink {
  backlog_item_id: string
  bug_id: string
  team_id: string
  is_primary: boolean
  created_at?: string
}

export interface LinkedBacklogBug extends Pick<Bug, 'id' | 'title' | 'severity' | 'reviewed' | 'tester' | 'page' | 'device' | 'category' | 'description'> {
  attachments?: Attachment[]
}

export interface BacklogItem {
  id: string
  team_id: string
  display_id: string
  sequence_number: number
  title: string
  description?: string | null
  type: BacklogItemType
  priority: BacklogPriority
  column_id?: string | null
  product_id?: string | null
  parent_item_id?: string | null
  milestone_id?: string | null
  assignee_user_id?: string | null
  source_snapshot?: Record<string, unknown>
  external_provider?: string | null
  external_id?: string | null
  external_url?: string | null
  sort_order: number
  archived_at?: string | null
  archived_by?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  comments: BacklogComment[]
  attachments: BacklogAttachment[]
  bug_links: BacklogBugLink[]
  linked_bugs: LinkedBacklogBug[]
}

export type BacklogItemUpdate = Partial<Pick<BacklogItem, 'title' | 'description' | 'type' | 'priority' | 'product_id' | 'parent_item_id' | 'milestone_id' | 'assignee_user_id' | 'column_id'>>

export interface NewBacklogItemInput {
  title: string
  description?: string
  type: BacklogItemType
  priority: BacklogPriority
  column_id?: string | null
  product_id?: string | null
  parent_item_id?: string | null
  milestone_id?: string | null
  assignee_user_id?: string | null
  source_snapshot?: Record<string, unknown>
  linked_bug_id?: string | null
}

export interface ConvertBugToBacklogInput {
  bug: Bug
  title?: string
  description?: string
  product_id?: string | null
  parent_item_id?: string | null
  milestone_id?: string | null
  assignee_user_id?: string | null
  priority?: BacklogPriority
  column_id?: string | null
}
