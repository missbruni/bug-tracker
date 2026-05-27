import type { Bug } from '../domains/bugs/model'

const CSV_COLUMNS = [
  'ID',
  'Title',
  'Description',
  'Severity',
  'Status',
  'Tester',
  'Device',
  'Page',
  'Category',
  'Created At',
  'Comments',
  'Attachments',
  'Backlog URL',
  'Session ID',
] as const

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function bugsToCSV(bugs: Bug[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows = bugs.map((bug) => {
    const status = bug.reviewed ? 'Completed' : 'Active'
    const createdAt = bug.created_at
      ? new Date(bug.created_at).toLocaleString()
      : ''
    const commentCount = String(bug.comments.length)
    const attachmentCount = String(bug.attachments.length)

    const fields = [
      bug.id,
      bug.title,
      bug.description || '',
      bug.severity,
      status,
      bug.tester,
      bug.device || '',
      bug.page || '',
      bug.category || '',
      createdAt,
      commentCount,
      attachmentCount,
      bug.backlog_url || '',
      bug.session_id || '',
    ]

    return fields.map(escapeCsvField).join(',')
  })

  return [header, ...rows].join('\n')
}

export type ExportFormat = 'csv' | 'json'

function bugToRecord(bug: Bug) {
  return {
    id: bug.id,
    title: bug.title,
    description: bug.description || '',
    severity: bug.severity,
    status: bug.reviewed ? 'Completed' : 'Active',
    tester: bug.tester,
    device: bug.device || '',
    page: bug.page || '',
    category: bug.category || '',
    created_at: bug.created_at || '',
    comments: bug.comments.length,
    attachments: bug.attachments.length,
    backlog_url: bug.backlog_url || '',
    session_id: bug.session_id || '',
  }
}

export function bugsToJSON(bugs: Bug[]): string {
  return JSON.stringify(bugs.map(bugToRecord), null, 2)
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8;',
  json: 'application/json;charset=utf-8;',
}

export function downloadFile(content: string, filename: string, format: ExportFormat): void {
  const blob = new Blob([content], { type: MIME_TYPES[format] })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
