import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../lib/useAuth'
import { useTeamAccess } from '../../lib/teamAccess'
import { getUserDisplayName } from '../../lib/userDisplayName'
import { buildBacklogAttachmentPath, parseAttachmentStoragePath, scopeToTeam, withTeamPayload } from '../../lib/teamScope'
import { buildBugBacklogDescription, buildBugBacklogSnapshot, mapSeverityToBacklogPriority, normalizeBacklogKey } from './helpers'
import type { Bug, Attachment as BugAttachment } from '../bugs/model'
import type {
  BacklogAttachment,
  BacklogBugLink,
  BacklogColumn,
  BacklogComment,
  BacklogItem,
  BacklogItemUpdate,
  BacklogMilestone,
  BacklogProduct,
  BacklogTeamMember,
  ConvertBugToBacklogInput,
  NewBacklogItemInput,
} from './model'

interface UseBacklogOptions {
  realtimePaused?: boolean
  onRemoteChange?: () => void
}

interface UseBacklogReturn {
  columns: BacklogColumn[]
  items: BacklogItem[]
  milestones: BacklogMilestone[]
  products: BacklogProduct[]
  teamMembers: BacklogTeamMember[]
  loading: boolean
  createItem: (input: NewBacklogItemInput) => Promise<BacklogItem | null>
  convertBugToBacklog: (input: ConvertBugToBacklogInput) => Promise<BacklogItem | null>
  updateItem: (itemId: string, updates: BacklogItemUpdate) => Promise<boolean>
  moveItem: (itemId: string, columnId: string, sortOrder: number) => Promise<boolean>
  archiveItem: (itemId: string) => Promise<boolean>
  addComment: (itemId: string, text: string, mentionedUserIds?: string[]) => Promise<boolean>
  uploadAttachments: (itemId: string, files: File[]) => Promise<BacklogAttachment[]>
  deleteAttachment: (attachment: BacklogAttachment) => Promise<boolean>
  refreshBacklog: () => Promise<void>
}

interface OrgUserRow {
  id: string
  email: string
  display_name: string
  avatar_url?: string | null
}

interface TeamMemberRow {
  user_id: string
}

interface BacklogData {
  columns: BacklogColumn[]
  items: BacklogItem[]
  milestones: BacklogMilestone[]
  products: BacklogProduct[]
  teamMembers: BacklogTeamMember[]
}

const DEFAULT_SORT_GAP = 1000

function groupByItemId<T extends { backlog_item_id?: string | null }>(rows: T[]): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((accumulator, row) => {
    if (!row.backlog_item_id) return accumulator
    if (!accumulator[row.backlog_item_id]) accumulator[row.backlog_item_id] = []
    accumulator[row.backlog_item_id].push(row)
    return accumulator
  }, {})
}

function sortItemsByOrder(firstItem: BacklogItem, secondItem: BacklogItem): number {
  if (firstItem.sort_order !== secondItem.sort_order) return firstItem.sort_order - secondItem.sort_order
  return firstItem.created_at?.localeCompare(secondItem.created_at || '') || firstItem.title.localeCompare(secondItem.title)
}

export function calculateInsertSortOrder(items: BacklogItem[], columnId: string, beforeItemId?: string | null): number {
  const columnItems = items
    .filter((item) => item.column_id === columnId && !item.archived_at)
    .sort(sortItemsByOrder)

  if (!columnItems.length) return DEFAULT_SORT_GAP
  if (!beforeItemId) return Number(columnItems[columnItems.length - 1].sort_order) + DEFAULT_SORT_GAP

  const beforeIndex = columnItems.findIndex((item) => item.id === beforeItemId)
  if (beforeIndex === -1) return Number(columnItems[columnItems.length - 1].sort_order) + DEFAULT_SORT_GAP

  const beforeOrder = Number(columnItems[beforeIndex].sort_order)
  const previousOrder = beforeIndex > 0 ? Number(columnItems[beforeIndex - 1].sort_order) : 0
  return previousOrder + (beforeOrder - previousOrder) / 2
}

function buildLinkedBugs(
  links: BacklogBugLink[],
  bugs: Bug[],
  bugAttachments: Record<string, BugAttachment[]>,
): Record<string, BacklogItem['linked_bugs']> {
  const bugById = new Map(bugs.map((bug) => [bug.id, bug]))
  return links.reduce<Record<string, BacklogItem['linked_bugs']>>((accumulator, link) => {
    const bug = bugById.get(link.bug_id)
    if (!bug) return accumulator
    if (!accumulator[link.backlog_item_id]) accumulator[link.backlog_item_id] = []
    accumulator[link.backlog_item_id].push({
      id: bug.id,
      title: bug.title,
      severity: bug.severity,
      reviewed: bug.reviewed,
      tester: bug.tester,
      page: bug.page,
      device: bug.device,
      category: bug.category,
      description: bug.description,
      attachments: bugAttachments[bug.id] || [],
    })
    return accumulator
  }, {})
}

export function useBacklog(options: UseBacklogOptions = {}): UseBacklogReturn {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { activeTeamId, activeTeam } = useTeamAccess()
  const queryKey = React.useMemo(() => ['backlog-data', activeTeamId], [activeTeamId])
  const realtimePaused = options.realtimePaused ?? false
  const onRemoteChange = options.onRemoteChange
  const currentUserName = getUserDisplayName(user ?? null)

  const { data, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async (): Promise<BacklogData> => {
      if (!supabase || !activeTeamId) {
        return { columns: [], items: [], milestones: [], products: [], teamMembers: [] }
      }

      const columnsResult = await supabase.rpc('ensure_default_backlog_columns', { target_team_id: activeTeamId })
      const columns = ((columnsResult.data || []) as BacklogColumn[]).sort((firstColumn, secondColumn) => firstColumn.sort_order - secondColumn.sort_order)

      const [itemsRes, commentsRes, attachmentsRes, linksRes, milestonesRes, productsRes, membersRes, orgUsersRes] = await Promise.all([
        scopeToTeam(supabase.from('backlog_items').select('*').is('archived_at', null).order('sort_order'), activeTeamId),
        scopeToTeam(supabase.from('backlog_item_comments').select('*').order('created_at'), activeTeamId),
        scopeToTeam(supabase.from('backlog_item_attachments').select('*').order('created_at'), activeTeamId),
        scopeToTeam(supabase.from('backlog_item_bug_links').select('*').order('created_at'), activeTeamId),
        scopeToTeam(supabase.from('backlog_milestones').select('*').neq('status', 'archived').order('target_date', { ascending: true }), activeTeamId),
        scopeToTeam(supabase.from('products').select('id, team_id, name, slug').order('name'), activeTeamId),
        supabase.from('team_members').select('user_id').eq('team_id', activeTeamId).eq('status', 'active'),
        supabase.rpc('get_org_users'),
      ])

      const links = (linksRes.data || []) as BacklogBugLink[]
      const linkedBugIds = Array.from(new Set(links.map((link) => link.bug_id)))
      let linkedBugs: Bug[] = []
      let linkedBugAttachments: Record<string, BugAttachment[]> = {}

      if (linkedBugIds.length) {
        const [bugsRes, bugAttachmentsRes] = await Promise.all([
          scopeToTeam(supabase.from('bugs').select('id, title, severity, reviewed, tester, page, device, category, description').in('id', linkedBugIds), activeTeamId),
          scopeToTeam(supabase.from('attachments').select('*').in('bug_id', linkedBugIds), activeTeamId),
        ])
        linkedBugs = (bugsRes.data || []) as Bug[]
        linkedBugAttachments = ((bugAttachmentsRes.data || []) as Array<BugAttachment & { bug_id: string }>).reduce<Record<string, BugAttachment[]>>((accumulator, attachment) => {
          if (!accumulator[attachment.bug_id]) accumulator[attachment.bug_id] = []
          accumulator[attachment.bug_id].push(attachment)
          return accumulator
        }, {})
      }

      const commentsMap = groupByItemId((commentsRes.data || []) as BacklogComment[])
      const attachmentsMap = groupByItemId((attachmentsRes.data || []) as BacklogAttachment[])
      const linksMap = groupByItemId(links)
      const linkedBugsMap = buildLinkedBugs(links, linkedBugs, linkedBugAttachments)
      const memberIds = new Set(((membersRes.data || []) as TeamMemberRow[]).map((member) => member.user_id))
      const teamMembers = ((orgUsersRes.data || []) as OrgUserRow[])
        .filter((orgUser) => memberIds.has(orgUser.id))
        .sort((firstUser, secondUser) => firstUser.display_name.localeCompare(secondUser.display_name))

      const items = ((itemsRes.data || []) as BacklogItem[])
        .map((item) => ({
          ...item,
          comments: commentsMap[item.id] || [],
          attachments: attachmentsMap[item.id] || [],
          bug_links: linksMap[item.id] || [],
          linked_bugs: linkedBugsMap[item.id] || [],
        }))
        .sort(sortItemsByOrder)

      return {
        columns,
        items,
        milestones: (milestonesRes.data || []) as BacklogMilestone[],
        products: (productsRes.data || []) as BacklogProduct[],
        teamMembers,
      }
    },
    enabled: Boolean(supabase && activeTeamId),
  })

  const refreshBacklog = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  React.useEffect(() => {
    if (!supabase || !activeTeamId) return
    const sb = supabase
    const handleRemoteChange = () => {
      if (realtimePaused) {
        onRemoteChange?.()
        return
      }
      void refreshBacklog()
    }
    const scopedConfig = (table: string) => ({
      event: '*' as const,
      schema: 'public' as const,
      table,
      filter: `team_id=eq.${activeTeamId}`,
    })
    const channel = sb.channel(`backlog-realtime-${activeTeamId}`)
      .on('postgres_changes', scopedConfig('backlog_columns'), handleRemoteChange)
      .on('postgres_changes', scopedConfig('backlog_items'), handleRemoteChange)
      .on('postgres_changes', scopedConfig('backlog_item_comments'), handleRemoteChange)
      .on('postgres_changes', scopedConfig('backlog_item_attachments'), handleRemoteChange)
      .on('postgres_changes', scopedConfig('backlog_item_bug_links'), handleRemoteChange)
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [activeTeamId, realtimePaused, onRemoteChange, refreshBacklog])

  const columns = data?.columns || []
  const items = data?.items || []
  const teamMembers = data?.teamMembers || []

  const getTeamBacklogKey = () => normalizeBacklogKey(activeTeam?.backlog_key || activeTeam?.slug)

  const getNextSequence = async (): Promise<number> => {
    if (!supabase || !activeTeamId) return 1
    const { data: latest } = await scopeToTeam(
      supabase
        .from('backlog_items')
        .select('sequence_number')
        .order('sequence_number', { ascending: false })
        .limit(1),
      activeTeamId,
    )
    return Number(latest?.[0]?.sequence_number || 0) + 1
  }

  const createItem = async (input: NewBacklogItemInput): Promise<BacklogItem | null> => {
    if (!supabase || !activeTeamId) return null
    const targetColumnId = input.column_id || columns[0]?.id || null
    if (!targetColumnId) return null

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sequenceNumber = await getNextSequence()
      const displayId = `${getTeamBacklogKey()}-${sequenceNumber}`
      const sortOrder = calculateInsertSortOrder(items, targetColumnId)
      const { data: created, error } = await supabase
        .from('backlog_items')
        .insert(withTeamPayload({
          display_id: displayId,
          sequence_number: sequenceNumber,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          type: input.type,
          priority: input.priority,
          column_id: targetColumnId,
          product_id: input.product_id || null,
          parent_item_id: input.parent_item_id || null,
          milestone_id: input.milestone_id || null,
          assignee_user_id: input.assignee_user_id || null,
          source_snapshot: input.source_snapshot || {},
          sort_order: sortOrder,
          created_by: user?.id || null,
        }, activeTeamId))
        .select()
        .single()

      if (error) {
        if (error.code === '23505' && attempt < 2) continue
        console.error('Failed to create backlog item:', error)
        return null
      }

      if (input.linked_bug_id) {
        const { error: linkError } = await supabase
          .from('backlog_item_bug_links')
          .insert(withTeamPayload({
            backlog_item_id: created.id,
            bug_id: input.linked_bug_id,
            is_primary: true,
            created_by: user?.id || null,
          }, activeTeamId))
        if (linkError) console.error('Failed to link bug to backlog item:', linkError)
      }

      await refreshBacklog()
      return {
        ...(created as BacklogItem),
        comments: [],
        attachments: [],
        bug_links: [],
        linked_bugs: [],
      }
    }

    return null
  }

  const convertBugToBacklog = async (input: ConvertBugToBacklogInput): Promise<BacklogItem | null> => {
    const existingItem = input.bug.backlog_item_id
      ? items.find((item) => item.id === input.bug.backlog_item_id) || null
      : null
    if (existingItem) return existingItem

    return createItem({
      title: input.title || input.bug.title,
      description: input.description || buildBugBacklogDescription(input.bug),
      type: 'bug',
      priority: input.priority || mapSeverityToBacklogPriority(input.bug.severity),
      column_id: input.column_id,
      product_id: input.product_id ?? null,
      parent_item_id: input.parent_item_id ?? null,
      milestone_id: input.milestone_id ?? null,
      assignee_user_id: input.assignee_user_id ?? null,
      source_snapshot: buildBugBacklogSnapshot(input.bug),
      linked_bug_id: input.bug.id,
    })
  }

  const updateItem = async (
    itemId: string,
    updates: BacklogItemUpdate,
  ): Promise<boolean> => {
    if (!supabase || !activeTeamId) return false
    const { error } = await scopeToTeam(supabase.from('backlog_items').update(updates).eq('id', itemId), activeTeamId)
    if (error) {
      console.error('Failed to update backlog item:', error)
      return false
    }
    await refreshBacklog()
    return true
  }

  const moveItem = async (itemId: string, columnId: string, sortOrder: number): Promise<boolean> => {
    if (!supabase || !activeTeamId) return false
    queryClient.setQueryData(queryKey, (old: BacklogData | undefined) => {
      if (!old) return old
      return {
        ...old,
        items: old.items
          .map((item) => item.id === itemId ? { ...item, column_id: columnId, sort_order: sortOrder } : item)
          .sort(sortItemsByOrder),
      }
    })

    const { error } = await scopeToTeam(supabase.from('backlog_items').update({ column_id: columnId, sort_order: sortOrder }).eq('id', itemId), activeTeamId)
    if (error) {
      console.error('Failed to move backlog item:', error)
      await refreshBacklog()
      return false
    }
    return true
  }

  const archiveItem = async (itemId: string): Promise<boolean> => {
    if (!supabase || !activeTeamId) return false
    const { error } = await scopeToTeam(
      supabase
        .from('backlog_items')
        .update({ archived_at: new Date().toISOString(), archived_by: user?.id || null })
        .eq('id', itemId),
      activeTeamId,
    )
    if (error) {
      console.error('Failed to archive backlog item:', error)
      return false
    }
    await refreshBacklog()
    return true
  }

  const addComment = async (itemId: string, text: string, mentionedUserIds: string[] = []): Promise<boolean> => {
    if (!supabase || !activeTeamId || !text.trim()) return false
    const { error } = await supabase
      .from('backlog_item_comments')
      .insert(withTeamPayload({
        backlog_item_id: itemId,
        text: text.trim(),
        author: currentUserName,
        mentioned_user_ids: Array.from(new Set(mentionedUserIds)),
      }, activeTeamId))
    if (error) {
      console.error('Failed to add backlog comment:', error)
      return false
    }
    await refreshBacklog()
    return true
  }

  const uploadAttachments = async (itemId: string, files: File[]): Promise<BacklogAttachment[]> => {
    if (!supabase || !activeTeamId || files.length === 0) return []
    const sb = supabase
    const uploads = await Promise.all(files.map(async (file) => {
      const storagePath = buildBacklogAttachmentPath(activeTeamId, itemId, file.name)
      const { error } = await sb.storage.from('attachments').upload(storagePath, file)
      if (error) {
        console.error('Failed to upload backlog attachment:', error)
        return null
      }
      const { data: urlData } = sb.storage.from('attachments').getPublicUrl(storagePath)
      return { backlog_item_id: itemId, name: file.name, url: urlData.publicUrl, type: file.type, uploaded_by: user?.id || null, storagePath }
    }))
    const rows = uploads.filter(Boolean) as Array<{ backlog_item_id: string; name: string; url: string; type: string; uploaded_by: string | null; storagePath: string }>
    if (!rows.length) return []
    const { data: created, error } = await sb
      .from('backlog_item_attachments')
      .insert(rows.map(({ storagePath: _storagePath, ...row }) => withTeamPayload(row, activeTeamId)))
      .select()
    if (error) {
      console.error('Failed to create backlog attachment rows:', error)
      await sb.storage.from('attachments').remove(rows.map((row) => row.storagePath))
      return []
    }
    await refreshBacklog()
    return (created || []) as BacklogAttachment[]
  }

  const deleteAttachment = async (attachment: BacklogAttachment): Promise<boolean> => {
    if (!supabase || !activeTeamId || !attachment.id) return false
    const { error } = await scopeToTeam(supabase.from('backlog_item_attachments').delete().eq('id', attachment.id), activeTeamId)
    if (error) {
      console.error('Failed to delete backlog attachment:', error)
      return false
    }
    const path = parseAttachmentStoragePath(attachment.url)
    if (path) await supabase.storage.from('attachments').remove([path])
    await refreshBacklog()
    return true
  }

  return {
    columns,
    items,
    milestones: data?.milestones || [],
    products: data?.products || [],
    teamMembers,
    loading,
    createItem,
    convertBugToBacklog,
    updateItem,
    moveItem,
    archiveItem,
    addComment,
    uploadAttachments,
    deleteAttachment,
    refreshBacklog,
  }
}
