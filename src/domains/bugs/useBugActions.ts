import React from 'react'
import { supabase } from '../../supabaseClient'
import { playTickSound } from '../../lib/audio'
import { findTesterByName } from '../../lib/testerLookup'
import { useTeamAccess } from '../../lib/teamAccess'
import { shouldOpenPbiOnPublishSuccess } from '../../lib/azureSettings'
import { buildAttachmentPath, parseAttachmentStoragePath, scopeToTeam, withTeamPayload } from '../../lib/teamScope'
import { buildBugBacklogDescription, buildBugBacklogSnapshot, mapSeverityToBacklogPriority, normalizeBacklogKey } from '../backlog/helpers'
import type { Bug, Attachment } from './model'
import type { BacklogItem } from '../backlog/model'
import type { Severity } from '../../constants'

interface UseBugActionsParams {
  bug: Bug
  onUpdate: (bug: Bug) => void
  onDelete: (bugId: string) => void
  onPersistError?: (message: string) => void
  onReviewed?: (bug: Bug, undo: () => void, message?: string) => void
}

const SEVERITY_PREFIX: Record<Severity, string> = {
  critical: 'CRT',
  high: 'HI',
  low: 'LO',
}

const syncSeverityPrefixInTitle = (title: string, currentSeverity: Severity, nextSeverity: Severity) => {
  if (currentSeverity === nextSeverity) return title

  const currentPrefix = SEVERITY_PREFIX[currentSeverity]
  const nextPrefix = SEVERITY_PREFIX[nextSeverity]
  const match = title.match(/^(\s*)(\[?)(CRT|HI|LO)(\]?)(?=(?:\s*[-:]|\s|$))/)

  if (!match || match[3] !== currentPrefix) return title

  const [, leading, openBracket, , closeBracket] = match
  return title.replace(/^(\s*)(\[?)(CRT|HI|LO)(\]?)/, `${leading}${openBracket}${nextPrefix}${closeBracket}`)
}

export function useBugActions({ bug, onUpdate, onDelete, onPersistError, onReviewed }: UseBugActionsParams) {
  const mountedRef = React.useRef(true)
  const { activeTeamId, activeTeam } = useTeamAccess()

  React.useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const showUpdateError = (message = 'It was not possible to update the bug.') => {
    onPersistError?.(message)
  }

  const persistBugUpdate = async (updates: Partial<Pick<Bug, 'reviewed' | 'backlog_url' | 'azure_url' | 'backlog_item_id' | 'devin_url'>>) => {
    if (!supabase) return true

    const query = scopeToTeam(
      supabase
      .from('bugs')
      .update(updates)
      .eq('id', bug.id)
      .select('id')
      .maybeSingle(),
      activeTeamId,
    )

    const { data, error } = await query

    if (error || !data) {
      console.error('Failed to persist bug update:', {
        bugId: bug.id,
        updates,
        error: error?.message || 'No rows updated',
      })
      showUpdateError('It was not possible to update the bug.')
      return false
    }

    return true
  }

  const publishToAzure = async (withDevin = false, setPublishingMode: (m: 'azure' | 'devin' | 'mushi' | null) => void, setPublishMenuOpen: (v: boolean) => void) => {
    setPublishingMode(withDevin ? 'devin' : 'azure')
    setPublishMenuOpen(false)
    try {
      const res = await fetch('/api/backlog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bug.id,
          title: bug.title,
          description: (bug.description || '') + (bug.comments.length ? '\n\n---\nComments:\n' + bug.comments.map(comment => `- ${comment.text}${comment.time ? ` (${comment.time})` : ''}`).join('\n') : ''),
          severity: bug.severity,
          tester: bug.tester,
          page: bug.page,
          device: bug.device,
          category: bug.category || '',
          attachments: bug.attachments.map((a) => ({ name: a.name, url: a.url, type: a.type })),
          request_devin: withDevin,
        }),
      })
      const text = await res.text()
      let data: Record<string, unknown>
      try { data = JSON.parse(text) } catch { data = { success: false, error: `Invalid response: ${text.slice(0, 200)}` } }
      if (data.success) {
        const url = (data.url as string) || null
        const devinSession = (data.devin_session as string) || null
        const devinLink = devinSession ? `https://app.devin.ai/sessions/${devinSession}` : null
        const previousBug = bug
        const optimisticBug: Bug = {
          ...bug,
          backlog_url: url,
          azure_url: url,
          devin_url: devinLink ?? bug.devin_url,
          reviewed: true,
        }
        const updates: Partial<Pick<Bug, 'reviewed' | 'backlog_url' | 'azure_url' | 'devin_url'>> = {
          backlog_url: url,
          azure_url: url,
          reviewed: true,
        }
        if (devinLink) updates.devin_url = devinLink

        onUpdate(optimisticBug)

        const persisted = await persistBugUpdate(updates)
        if (!persisted) {
          onUpdate(previousBug)
          if (mountedRef.current) setPublishingMode(null)
          return
        }

        if (onReviewed) {
          onReviewed(optimisticBug, async () => {
            const revertedBug: Bug = { ...optimisticBug, reviewed: false }
            onUpdate(revertedBug)
            const reverted = await persistBugUpdate({ reviewed: false })
            if (!reverted) onUpdate(optimisticBug)
          }, 'Publish succeeded. Bug moved to completed.')
        }

        if (url && shouldOpenPbiOnPublishSuccess()) window.open(url, '_blank')
      } else {
        showUpdateError((data.error as string) || 'It was not possible to update the bug.')
      }
    } catch (err) {
      console.error('Publish to backlog failed:', err)
      showUpdateError(err instanceof Error ? err.message : 'It was not possible to update the bug.')
    }
    if (mountedRef.current) setPublishingMode(null)
  }

  const getBacklogColumns = async (): Promise<Array<{ id: string; name: string; sort_order: number }>> => {
    if (!supabase || !activeTeamId) return []
    const { data, error } = await supabase.rpc('ensure_default_backlog_columns', { target_team_id: activeTeamId })
    if (error) {
      console.error('Failed to load backlog columns:', error)
      return []
    }
    return ((data || []) as Array<{ id: string; name: string; sort_order: number }>).sort((firstColumn, secondColumn) => firstColumn.sort_order - secondColumn.sort_order)
  }

  const getNextBacklogSequence = async (): Promise<number> => {
    if (!supabase || !activeTeamId) return 1
    const { data } = await scopeToTeam(
      supabase
        .from('backlog_items')
        .select('sequence_number')
        .order('sequence_number', { ascending: false })
        .limit(1),
      activeTeamId,
    )
    return Number(data?.[0]?.sequence_number || 0) + 1
  }

  const createBacklogItemFromBug = async (): Promise<BacklogItem | null> => {
    if (!supabase || !activeTeamId) return null
    const columns = await getBacklogColumns()
    const firstColumnId = columns[0]?.id
    if (!firstColumnId) return null

    const backlogKey = normalizeBacklogKey(activeTeam?.backlog_key || activeTeam?.slug)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sequenceNumber = await getNextBacklogSequence()
      const displayId = `${backlogKey}-${sequenceNumber}`
      const { data: created, error } = await supabase
        .from('backlog_items')
        .insert(withTeamPayload({
          display_id: displayId,
          sequence_number: sequenceNumber,
          title: bug.title,
          description: buildBugBacklogDescription(bug),
          type: 'bug',
          priority: mapSeverityToBacklogPriority(bug.severity),
          column_id: firstColumnId,
          source_snapshot: buildBugBacklogSnapshot(bug),
        }, activeTeamId))
        .select()
        .single()

      if (error) {
        if (error.code === '23505' && attempt < 2) continue
        console.error('Failed to create native backlog item:', error)
        return null
      }

      const { error: linkError } = await supabase
        .from('backlog_item_bug_links')
        .insert(withTeamPayload({
          backlog_item_id: created.id,
          bug_id: bug.id,
          is_primary: true,
        }, activeTeamId))

      if (linkError) {
        console.error('Failed to link native backlog item:', linkError)
        return null
      }

      return created as BacklogItem
    }

    return null
  }

  const moveToMushiBacklog = async (setPublishingMode: (m: 'azure' | 'devin' | 'mushi' | null) => void): Promise<BacklogItem | null> => {
    if (bug.backlog_item_id) {
      window.location.href = `/backlog?item=${encodeURIComponent(bug.backlog_item_id)}`
      return null
    }

    setPublishingMode('mushi')
    const previousBug = bug
    try {
      const created = await createBacklogItemFromBug()
      if (!created) {
        showUpdateError('Failed to move bug to Mushi Backlog.')
        return null
      }

      const optimisticBug: Bug = { ...bug, backlog_item_id: created.id }
      onUpdate(optimisticBug)
      const persisted = await persistBugUpdate({ backlog_item_id: created.id })
      if (!persisted) {
        onUpdate(previousBug)
        return null
      }

      window.location.href = `/backlog?item=${encodeURIComponent(created.display_id)}`
      return created
    } finally {
      if (mountedRef.current) setPublishingMode(null)
    }
  }

  const notifyMentionedUsers = async (commentId: number, mentionedUserIds: string[]) => {
    if (!supabase || mentionedUserIds.length === 0) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    try {
      const res = await fetch('/api/bug-comment-mention', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bugId: bug.id,
          commentId,
          mentionedUserIds,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        console.warn('[mentions] email notification failed:', body.error || res.statusText)
      } else {
        const body = await res.json().catch(() => ({})) as { sent?: number; warning?: string }
        if (body.warning) console.warn('[mentions] email notification warning:', body.warning)
        else if (body.sent === 0) console.warn('[mentions] no email notifications were sent: No recipients or email provider not configured.')
      }
    } catch (mentionError) {
      console.warn('[mentions] email notification failed:', mentionError)
    }
  }

  const addComment = async (commentText: string, mentionedUserIds: string[] = []) => {
    if (!commentText.trim()) return
    const uniqueMentionedUserIds = Array.from(new Set(mentionedUserIds))
    const newComment = { text: commentText.trim(), time: 'Just now', mentioned_user_ids: uniqueMentionedUserIds }

    if (supabase) {
      const { data, error } = await supabase
        .from('comments')
        .insert(withTeamPayload({
          bug_id: bug.id,
          text: newComment.text,
          time: newComment.time,
          mentioned_user_ids: uniqueMentionedUserIds,
        }, activeTeamId))
        .select()
      if (!error && data?.[0]) {
        onUpdate({ ...bug, comments: [...bug.comments, { ...newComment, id: data[0].id }] })
        void notifyMentionedUsers(data[0].id as number, uniqueMentionedUserIds)
      }
    } else {
      onUpdate({ ...bug, comments: [...bug.comments, newComment] })
    }
  }

  const deleteComment = async (comment: { id?: number }, index: number) => {
    if (supabase && comment.id) {
      let deleteQuery = supabase.from('comments').delete().eq('id', comment.id)
      deleteQuery = scopeToTeam(deleteQuery, activeTeamId)
      const { error } = await deleteQuery
      if (error) { console.error('Failed to delete comment:', error); return }
    }
    onUpdate({ ...bug, comments: bug.comments.filter((_, i) => i !== index) })
  }

  const deleteAttachment = async (attachment: { id?: number; url?: string }, index: number) => {
    if (supabase && attachment.id) {
      let deleteQuery = supabase.from('attachments').delete().eq('id', attachment.id)
      deleteQuery = scopeToTeam(deleteQuery, activeTeamId)
      const { error } = await deleteQuery
      if (error) { console.error('Failed to delete attachment:', error); return }
      const path = parseAttachmentStoragePath(attachment.url)
      if (path) {
        await supabase.storage.from('attachments').remove([path])
      }
    }
    onUpdate({ ...bug, attachments: bug.attachments.filter((_, i) => i !== index) })
  }

  const toggleReviewed = async () => {
    const newVal = !bug.reviewed
    if (newVal) playTickSound()

    const previousBug = bug
    onUpdate({ ...bug, reviewed: newVal })

    const persisted = await persistBugUpdate({ reviewed: newVal })
    if (!persisted) {
      onUpdate(previousBug)
      return
    }

    if (newVal && onReviewed) {
      onReviewed(bug, async () => {
        onUpdate({ ...bug, reviewed: false })
        await persistBugUpdate({ reviewed: false })
      })
    }
  }

  const softDeleteBug = (): void => {
    onDelete(bug.id)
  }

  const hardDeleteBug = async (): Promise<boolean> => {
    if (!supabase) return true

    const storagePaths = bug.attachments
      .map((att) => parseAttachmentStoragePath(att.url))
      .filter(Boolean)
      .map((path) => path!)

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from('attachments').remove(storagePaths)
      if (storageError) console.error('Failed to delete attachment files:', storageError)
    }

    let commentsDelete = supabase.from('comments').delete().eq('bug_id', bug.id)
    commentsDelete = scopeToTeam(commentsDelete, activeTeamId)
    const { error: commentsError } = await commentsDelete
    if (commentsError) { console.error('Failed to delete bug comments:', commentsError); return false }

    let attachmentsDelete = supabase.from('attachments').delete().eq('bug_id', bug.id)
    attachmentsDelete = scopeToTeam(attachmentsDelete, activeTeamId)
    const { error: attachmentsError } = await attachmentsDelete
    if (attachmentsError) { console.error('Failed to delete bug attachments:', attachmentsError); return false }

    let bugDelete = supabase.from('bugs').delete().eq('id', bug.id)
    bugDelete = scopeToTeam(bugDelete, activeTeamId)
    const { error: bugError } = await bugDelete
    if (bugError) { console.error('Failed to delete bug:', bugError); return false }

    return true
  }

  const uploadFiles = async (files: File[]) => {
    let newAttachments: Attachment[]
    if (supabase) {
      // Upload all files in parallel, then bulk-insert attachment rows
      const sb = supabase
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const storagePath = buildAttachmentPath(activeTeamId, bug.id, file.name)
          const { error } = await sb.storage.from('attachments').upload(storagePath, file)
          if (error) return null
          const { data: urlData } = sb.storage.from('attachments').getPublicUrl(storagePath)
          return { bug_id: bug.id, name: file.name, url: urlData.publicUrl, type: file.type }
        }),
      )
      const validUploads = uploadResults.filter(Boolean) as { bug_id: string; name: string; url: string; type: string }[]
      if (validUploads.length) {
        const { data: rows } = await sb
          .from('attachments')
          .insert(validUploads.map(u => withTeamPayload(u, activeTeamId)))
          .select()
        newAttachments = (rows || []) as Attachment[]
      } else {
        newAttachments = []
      }
    } else {
      newAttachments = files.map(file => ({ name: file.name, url: URL.createObjectURL(file), type: file.type }))
    }
    if (newAttachments.length) {
      onUpdate({ ...bug, attachments: [...bug.attachments, ...newAttachments] })
    }
  }

  const saveBugEdit = async (editFields: { title: string; description: string; severity: Severity; tester: string; device: string; page: string; category: string }) => {
    const normalizedTitle = syncSeverityPrefixInTitle(editFields.title, bug.severity, editFields.severity)
    const normalizedTester = editFields.tester || 'Unknown'
    const matchedTester = await findTesterByName(normalizedTester, activeTeamId)
    const updates = {
      title: normalizedTitle,
      description: editFields.description,
      severity: editFields.severity,
      tester: normalizedTester,
      tester_id: matchedTester?.id || null,
      device: editFields.device || '\u2014',
      page: editFields.page || '\u2014',
      category: editFields.category || null,
    }
    if (supabase) {
      let updateQuery = supabase.from('bugs').update(updates).eq('id', bug.id)
      updateQuery = scopeToTeam(updateQuery, activeTeamId)
      const { error } = await updateQuery
      if (error) {
        console.error('Failed to update bug:', error)
        showUpdateError('Failed to save changes.')
        return false
      }
    }
    onUpdate({ ...bug, ...updates })
    return true
  }

  return {
    publishToAzure,
    publishToBacklog: publishToAzure,
    moveToMushiBacklog,
    addComment,
    deleteComment,
    deleteAttachment,
    toggleReviewed,
    softDeleteBug,
    hardDeleteBug,
    uploadFiles,
    saveBugEdit,
  }
}
