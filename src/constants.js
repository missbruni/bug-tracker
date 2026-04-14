export const N8N_WEBHOOK_URL = 'https://n8n.dev.ax.accessacloud.com/webhook/bug-to-backlog'

export const SEVERITIES = ['critical', 'high', 'low']

export const SEVERITY_STYLES = {
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
