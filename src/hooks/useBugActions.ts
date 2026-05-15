import { useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { N8N_WEBHOOK_URL } from '../constants'
import { playTickSound } from '../lib/audio'
import type { Bug, Attachment } from '../types'
import type { Severity } from '../constants'

interface UseBugActionsParams {
  bug: Bug
  onUpdate: (bug: Bug) => void
  onDelete: (bugId: string) => void
  onPersistError?: (message: string) => void
  onReviewed?: (bug: Bug, undo: () => void) => void
}

export function useBugActions({ bug, onUpdate, onDelete, onPersistError, onReviewed }: UseBugActionsParams) {
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const showUpdateError = (message = 'It was not possible to update the bug.') => {
    onPersistError?.(message)
  }

  const persistBugUpdate = async (updates: Partial<Pick<Bug, 'reviewed' | 'backlog_url' | 'devin_url'>>) => {
    if (!supabase) return true

    const { data, error } = await supabase
      .from('bugs')
      .update(updates)
      .eq('id', bug.id)
      .select('id')
      .maybeSingle()

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

        if (url) window.open(url, '_blank')
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
        .insert({ bug_id: bug.id, text: newComment.text, time: newComment.time })
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
      const { error } = await supabase.from('comments').delete().eq('id', comment.id)
      if (error) { console.error('Failed to delete comment:', error); return }
    }
    onUpdate({ ...bug, comments: bug.comments.filter((_, i) => i !== index) })
  }

  const deleteAttachment = async (attachment: { id?: number; url?: string }, index: number) => {
    if (supabase && attachment.id) {
      const { error } = await supabase.from('attachments').delete().eq('id', attachment.id)
      if (error) { console.error('Failed to delete attachment:', error); return }
      if (attachment.url) {
        const path = attachment.url.split('/attachments/')[1]
        if (path) await supabase.storage.from('attachments').remove([decodeURIComponent(path)])
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

  const deleteBug = async () => {
    if (!window.confirm(`Delete bug ${bug.id}? This cannot be undone.`)) return

    if (supabase) {
      const storagePaths = bug.attachments
        .map((att) => att.url?.split('/attachments/')[1])
        .filter(Boolean)
        .map((path) => decodeURIComponent(path!))

      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from('attachments').remove(storagePaths)
        if (storageError) console.error('Failed to delete attachment files:', storageError)
      }

      const { error: commentsError } = await supabase.from('comments').delete().eq('bug_id', bug.id)
      if (commentsError) { console.error('Failed to delete bug comments:', commentsError); return }

      const { error: attachmentsError } = await supabase.from('attachments').delete().eq('bug_id', bug.id)
      if (attachmentsError) { console.error('Failed to delete bug attachments:', attachmentsError); return }

      const { error: bugError } = await supabase.from('bugs').delete().eq('id', bug.id)
      if (bugError) { console.error('Failed to delete bug:', bugError); return }
    }

    onDelete(bug.id)
  }

  const uploadFiles = async (files: File[]) => {
    const newAttachments: Attachment[] = []
    for (const file of files) {
      if (supabase) {
        const path = `${bug.id}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('attachments').upload(path, file)
        if (!error) {
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
          const { data: row } = await supabase
            .from('attachments')
            .insert({ bug_id: bug.id, name: file.name, url: urlData.publicUrl, type: file.type })
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
    const updates = {
      title: editFields.title,
      description: editFields.description,
      severity: editFields.severity,
      tester: editFields.tester || 'Unknown',
      device: editFields.device || '\u2014',
      page: editFields.page || '\u2014',
      category: editFields.category || null,
    }
    if (supabase) {
      const { error } = await supabase.from('bugs').update(updates).eq('id', bug.id)
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
