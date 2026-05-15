export type Severity = 'critical' | 'high' | 'low'

export interface SeverityStyle {
  badge: string
  bg: string
  text: string
}

export type SeverityStyleMap = Record<Severity, SeverityStyle>

export const N8N_WEBHOOK_URL = 'https://n8n.dev.ax.accessacloud.com/webhook/bug-to-backlog'

export const SEVERITIES: Severity[] = ['critical', 'high', 'low']

export const SEVERITY_STYLES: { light: SeverityStyleMap; dark: SeverityStyleMap } = {
  light: {
    critical: { badge: '#dc2626', bg: '#fef2f2', text: '#991b1b' },
    high: { badge: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
    low: { badge: '#3b82f6', bg: '#eff6ff', text: '#1e40af' },
  },
  dark: {
    critical: { badge: '#dc2626', bg: '#450a0a', text: '#fca5a5' },
    high: { badge: '#f59e0b', bg: '#451a03', text: '#fcd34d' },
    low: { badge: '#3b82f6', bg: '#172554', text: '#93c5fd' },
  },
}

export const SESSION_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100 dark:bg-gray-800', text: 'text-slate-600 dark:text-gray-400' },
  active: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-400' },
  completed: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400' },
}
