import { useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { N8N_WEBHOOK_URL } from '../constants'
import { playTickSound } from '../lib/audio'
import { findTesterByName } from '../lib/testerLookup'
import { useTeamAccess } from '../lib/teamAccess'
import { shouldOpenPbiOnPublishSuccess } from '../lib/azureSettings'
import { buildAttachmentPath, parseAttachmentStoragePath, scopeToTeam, withTeamPayload } from '../lib/teamScope'
import type { Bug, Attachment } from '../types'
import type { Severity } from '../constants'

interface UseBugActionsParams {
  bug: Bug
  onUpdate: (bug: Bug) => void
  onDelete: (bugId: string) => void
  onPersistError?: (message: string) => void
  onReviewed?: (bug: Bug, undo: () => void, message?: string) => void
}

export function useBugActions({ bug, onUpdate, onDelete, onPersistError, onReviewed }: UseBugActionsParams) {
  const mountedRef = useRef(true)
  const { activeTeamId } = useTeamAccess()

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const showUpdateError = (message = 'It was not possible to update the bug.') => {
    onPersistError?.(message)
  }

  const persistBugUpdate = async (updates: Partial<Pick<Bug, 'reviewed' | 'backlog_url' | 'devin_url'>>) => {
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

  const publishToBacklog = async (withDevin = false, setPublishingMode: (m: 'backlog' | 'devin' | null) => void, setPublishMenuOpen: (v: boolean) => void) => {
    setPublishingMode(withDevin ? 'devin' : 'backlog')
    setPublishMenuOpen(false)
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bug.id,
          title: bug.title,
          description: (bug.description || '') + (bug.comments.length ? '\n\n---\nComments:\n' + bug.comments.map(c => `- ${c.text}${c.time ? ` (${c.time})` : ''}`).join('\n') : ''),
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
          devin_url: devinLink ?? bug.devin_url,
          reviewed: true,
        }
        const updates: Partial<Pick<Bug, 'reviewed' | 'backlog_url' | 'devin_url'>> = {
          backlog_url: url,
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

  const addComment = async (commentText: string) => {
    if (!commentText.trim()) return
    const newComment = { text: commentText.trim(), time: 'Just now' }

    if (supabase) {
      const { data, error } = await supabase
        .from('comments')
        .insert(withTeamPayload({ bug_id: bug.id, text: newComment.text, time: newComment.time }, activeTeamId))
        .select()
      if (!error && data?.[0]) {
        onUpdate({ ...bug, comments: [...bug.comments, { ...newComment, id: data[0].id }] })
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

  const deleteBug = async (): Promise<boolean> => {

    if (supabase) {
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
    }

    onDelete(bug.id)
    return true
  }

  const uploadFiles = async (files: File[]) => {
    const newAttachments: Attachment[] = []
    for (const file of files) {
      if (supabase) {
        const storagePath = buildAttachmentPath(activeTeamId, bug.id, file.name)
        const { error } = await supabase.storage.from('attachments').upload(storagePath, file)
        if (!error) {
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(storagePath)
          const { data: row } = await supabase
            .from('attachments')
            .insert(withTeamPayload({ bug_id: bug.id, name: file.name, url: urlData.publicUrl, type: file.type }, activeTeamId))
            .select()
          if (row?.[0]) newAttachments.push(row[0])
        }
      } else {
        newAttachments.push({ name: file.name, url: URL.createObjectURL(file), type: file.type })
      }
    }
    if (newAttachments.length) {
      onUpdate({ ...bug, attachments: [...bug.attachments, ...newAttachments] })
    }
  }

  const saveBugEdit = async (editFields: { title: string; description: string; severity: Severity; tester: string; device: string; page: string; category: string }) => {
    const normalizedTester = editFields.tester || 'Unknown'
    const matchedTester = await findTesterByName(normalizedTester, activeTeamId)
    const updates = {
      title: editFields.title,
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
    publishToBacklog,
    addComment,
    deleteComment,
    deleteAttachment,
    toggleReviewed,
    deleteBug,
    uploadFiles,
    saveBugEdit,
  }
}
