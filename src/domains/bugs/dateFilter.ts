/**
 * Check whether a date falls within a named date range.
 * Shared between bug filtering and question filtering.
 */
export function matchesDateFilter(dateString: string | undefined | null, filter: string): boolean {
  if (filter === 'all' || !dateString) return true

  const now = new Date()
  const date = new Date(dateString)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filter) {
    case 'today':
      return date >= startOfToday

    case 'yesterday': {
      const startOfYesterday = new Date(startOfToday)
      startOfYesterday.setDate(startOfYesterday.getDate() - 1)
      return date >= startOfYesterday && date < startOfToday
    }

    case '7d': {
      const weekAgo = new Date(startOfToday)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return date >= weekAgo
    }

    case '30d': {
      const monthAgo = new Date(startOfToday)
      monthAgo.setDate(monthAgo.getDate() - 30)
      return date >= monthAgo
    }

    default:
      return true
  }
}
