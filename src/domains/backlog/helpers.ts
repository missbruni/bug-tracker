import type { Severity } from '../../constants'
import type { Bug } from '../bugs/model'
import type { BacklogPriority } from './model'

export const BACKLOG_PRIORITIES: BacklogPriority[] = ['urgent', 'high', 'medium', 'low']

export function mapSeverityToBacklogPriority(severity: Severity): BacklogPriority {
  if (severity === 'critical') return 'urgent'
  if (severity === 'high') return 'high'
  return 'low'
}

export function normalizeBacklogKey(value: string | null | undefined, fallback = 'TEAM'): string {
  const cleaned = (value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
  return cleaned || fallback
}

export function buildBugBacklogDescription(bug: Bug): string {
  const lines = [
    bug.description || '',
    '',
    '---',
    `Source bug: ${bug.id}`,
    `Severity: ${bug.severity}`,
    `Tester: ${bug.tester || 'Unknown'}`,
    `Page: ${bug.page || '-'}`,
    `Device: ${bug.device || '-'}`,
  ]

  if (bug.category) lines.push(`Category: ${bug.category}`)
  if (bug.comments.length) {
    lines.push('', 'Bug comments:')
    for (const comment of bug.comments) {
      lines.push(`- ${comment.text}${comment.time ? ` (${comment.time})` : ''}`)
    }
  }
  if (bug.attachments.length) {
    lines.push('', 'Bug attachments:')
    for (const attachment of bug.attachments) {
      lines.push(`- ${attachment.name}: ${attachment.url}`)
    }
  }

  return lines.join('\n').trim()
}

export function buildBugBacklogSnapshot(bug: Bug): Record<string, unknown> {
  return {
    bug_id: bug.id,
    title: bug.title,
    severity: bug.severity,
    tester: bug.tester,
    page: bug.page,
    device: bug.device,
    category: bug.category,
    description: bug.description,
    comments: bug.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      time: comment.time,
    })),
    attachments: bug.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      type: attachment.type,
    })),
  }
}
