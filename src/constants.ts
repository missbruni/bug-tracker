export type Severity = 'critical' | 'high' | 'low'

export interface SeverityStyle {
  badge: string
  bg: string
  text: string
}

export type SeverityStyleMap = Record<Severity, SeverityStyle>

export const SEVERITIES: Severity[] = ['critical', 'high', 'low']

export const SEVERITY_STYLES: { light: SeverityStyleMap; dark: SeverityStyleMap } = {
  light: {
    critical: { badge: '#D63384', bg: '#fdf2f8', text: '#9d174d' },
    high: { badge: '#00A38C', bg: '#e6f7f5', text: '#065f53' },
    low: { badge: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
  },
  dark: {
    critical: { badge: '#FF007A', bg: 'rgba(255, 0, 122, 0.08)', text: '#ff6aaf' },
    high: { badge: '#00FFCC', bg: 'rgba(0, 255, 204, 0.08)', text: '#00ffcc' },
    low: { badge: '#818cf8', bg: 'rgba(129, 140, 248, 0.08)', text: '#a5b4fc' },
  },
}

export const PAGES = ['Home', 'Availability', 'Add ons', 'Summary', 'Payment', 'Confirmation'] as const

export const SESSION_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'badge-slate', text: '', border: '#94A29D' },
  active: { bg: 'badge-blue', text: '', border: '#00A38C' },
  completed: { bg: 'badge-green', text: '', border: '#00A38C' },
}
