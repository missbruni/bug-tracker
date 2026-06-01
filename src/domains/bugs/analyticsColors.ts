// Chart color palette for the analytics page.
// Light-mode values follow the Pastel Pixel remap in index.css.
// Dark-mode values follow the Mushi neon remap.

const LIGHT = {
  critical: '#D63384',
  high: '#00A38C',
  low: '#6366f1',
  draft: '#94a3b8',
  active: '#00A38C',
  completed: '#6366f1',
  grid: '#e2e8f0',
  text: '#64748b',
  kill: '#C944CD',
} as const

const DARK = {
  critical: '#FF007A',
  high: '#00FFCC',
  low: '#818cf8',
  draft: '#7B8B86',
  active: '#00FFCC',
  completed: '#818cf8',
  grid: '#2f353d',
  text: '#94A29D',
  kill: '#C944CD',
} as const

export type AnalyticsPalette = Record<keyof typeof LIGHT, string>

export function getAnalyticsPalette(isDark: boolean): AnalyticsPalette {
  return isDark ? DARK : LIGHT
}
