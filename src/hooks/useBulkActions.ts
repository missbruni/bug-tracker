import React from 'react'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam, parseAttachmentStoragePath } from '../lib/teamScope'
import type { Bug } from '../domains/bugs/model'

export interface BulkProgress {
  total: number
  completed: number
  label: string
}

export function useBulkActions() {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = React.useState(false)
  const [progress, setProgress] = React.useState<BulkProgress | null>(null)
  const { activeTeamId } = useTeamAccess()

  const toggleSelection = (bugId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(bugId)) {
        next.delete(bugId)
      } else {
        next.add(bugId)
      }
      return next
    })
  }

  const selectAll = (bugIds: string[]) => {
    setSelectedIds(new Set(bugIds))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setProgress(null)
  }

  const enterSelectionMode = () => {
    setSelectionMode(true)
  }

  const bulkMarkReviewed = async (
    bugs: Bug[],
    onUpdate: (bug: Bug) => void,
  ): Promise<{ successCount: number; errorCount: number }> => {
    const targetBugs = bugs.filter((bug) => selectedIds.has(bug.id) && !bug.reviewed)
    if (!targetBugs.length) return { successCount: 0, errorCount: 0 }

    let successCount = 0
    let errorCount = 0
    setProgress({ total: targetBugs.length, completed: 0, label: 'Marking reviewed' })

    if (supabase) {
      const targetIds = targetBugs.map((bug) => bug.id)
      const query = scopeToTeam(
        supabase.from('bugs').update({ reviewed: true }).in('id', targetIds),
        activeTeamId,
      )
      const { error } = await query
      if (error) {
        console.error('Bulk mark reviewed failed:', error)
        errorCount = targetBugs.length
      } else {
        successCount = targetBugs.length
        for (const bug of targetBugs) {
          onUpdate({ ...bug, reviewed: true })
        }
      }
    } else {
      for (const bug of targetBugs) {
        onUpdate({ ...bug, reviewed: true })
        successCount++
      }
    }

    setProgress({ total: targetBugs.length, completed: targetBugs.length, label: 'Marking reviewed' })
    return { successCount, errorCount }
  }

  const bulkDelete = async (
    bugs: Bug[],
    onDeleteFromState: (bugId: string) => void,
  ): Promise<{ successCount: number; errorCount: number }> => {
    const targetBugs = bugs.filter((bug) => selectedIds.has(bug.id))
    if (!targetBugs.length) return { successCount: 0, errorCount: 0 }

    let successCount = 0
    let errorCount = 0
    setProgress({ total: targetBugs.length, completed: 0, label: 'Deleting' })

    for (let index = 0; index < targetBugs.length; index++) {
      const bug = targetBugs[index]
      try {
        if (supabase) {
          // Delete storage files
          const storagePaths = bug.attachments
            .map((att) => parseAttachmentStoragePath(att.url))
            .filter(Boolean) as string[]
          if (storagePaths.length) {
            await supabase.storage.from('attachments').remove(storagePaths)
          }

          // Delete comments, attachments, then bug
          await scopeToTeam(supabase.from('comments').delete().eq('bug_id', bug.id), activeTeamId)
          await scopeToTeam(supabase.from('attachments').delete().eq('bug_id', bug.id), activeTeamId)
          const { error } = await scopeToTeam(supabase.from('bugs').delete().eq('id', bug.id), activeTeamId)
          if (error) throw error
        }
        onDeleteFromState(bug.id)
        successCount++
      } catch (err) {
        console.error(`Failed to delete bug ${bug.id}:`, err)
        errorCount++
      }
      setProgress({ total: targetBugs.length, completed: index + 1, label: 'Deleting' })
    }

    return { successCount, errorCount }
  }

  const bulkPublish = async (
    bugs: Bug[],
    onUpdate: (bug: Bug) => void,
  ): Promise<{ successCount: number; errorCount: number }> => {
    const targetBugs = bugs.filter((bug) => selectedIds.has(bug.id) && !bug.backlog_url)
    if (!targetBugs.length) return { successCount: 0, errorCount: 0 }

    let successCount = 0
    let errorCount = 0
    setProgress({ total: targetBugs.length, completed: 0, label: 'Publishing' })

    for (let index = 0; index < targetBugs.length; index++) {
      const bug = targetBugs[index]
      try {
        const response = await fetch('/api/backlog/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: bug.id,
            title: bug.title,
            description: (bug.description || '') +
              (bug.comments.length
                ? '\n\n---\nComments:\n' +
                  bug.comments.map((comment) => `- ${comment.text}${comment.time ? ` (${comment.time})` : ''}`).join('\n')
                : ''),
            severity: bug.severity,
            tester: bug.tester,
            page: bug.page,
            device: bug.device,
            category: bug.category || '',
            attachments: bug.attachments.map((att) => ({ name: att.name, url: att.url, type: att.type })),
            request_devin: false,
          }),
        })

        const text = await response.text()
        let data: Record<string, unknown>
        try {
          data = JSON.parse(text)
        } catch {
          data = { success: false }
        }

        if (data.success) {
          const backlogUrl = (data.url as string) || null
          const updates: Partial<Bug> = { backlog_url: backlogUrl, reviewed: true }

          if (supabase) {
            await scopeToTeam(
              supabase.from('bugs').update({ backlog_url: backlogUrl, reviewed: true }).eq('id', bug.id),
              activeTeamId,
            )
          }
          onUpdate({ ...bug, ...updates })
          successCount++
        } else {
          errorCount++
        }
      } catch (err) {
        console.error(`Failed to publish bug ${bug.id}:`, err)
        errorCount++
      }
      setProgress({ total: targetBugs.length, completed: index + 1, label: 'Publishing' })
    }

    return { successCount, errorCount }
  }

  return {
    selectedIds,
    selectionMode,
    progress,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    bulkMarkReviewed,
    bulkDelete,
    bulkPublish,
    setProgress,
  }
}
