import { useState, useEffect, useMemo } from 'react'
import { SEVERITIES } from '../constants'
import { matchesDateFilter } from '../lib/dateFilter'
import type { Bug, Question } from '../types'
import type { Severity } from '../constants'

function getParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) || ''
}

interface UseBugFiltersReturn {
  severityFilter: string
  setSeverityFilter: (v: string) => void
  search: string
  setSearch: (v: string) => void
  testerFilter: string
  setTesterFilter: (v: string) => void
  dateFilter: string
  setDateFilter: (v: string) => void
  sortOrder: string
  setSortOrder: (v: string) => void
  sessionFilter: string
  setSessionFilter: (v: string) => void
  testers: string[]
  filtered: Bug[]
  activeBugs: Bug[]
  counts: Record<Severity, number>
  nextIds: Record<Severity, number>
  grouped: Record<string, Bug[]>
  filteredQuestions: Question[]
}

export function useBugFilters(bugs: Bug[], questions: Question[]): UseBugFiltersReturn {
  const [severityFilter, setSeverityFilter] = useState(() => getParam('severity') || 'all')
  const [search, setSearch] = useState(() => getParam('q') || '')
  const [testerFilter, setTesterFilter] = useState(() => getParam('tester') || 'all')
  const [dateFilter, setDateFilter] = useState(() => getParam('date') || 'all')
  const [sortOrder, setSortOrder] = useState(() => getParam('sort') || 'default')
  const [sessionFilter, setSessionFilter] = useState(() => getParam('session') || 'all')

  // Sync filters to URL
  useEffect(() => {
    const p = new URLSearchParams()
    if (search) p.set('q', search)
    if (severityFilter !== 'all') p.set('severity', severityFilter)
    if (testerFilter !== 'all') p.set('tester', testerFilter)
    if (dateFilter !== 'all') p.set('date', dateFilter)
    if (sortOrder !== 'default') p.set('sort', sortOrder)
    if (sessionFilter !== 'all') p.set('session', sessionFilter)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [search, severityFilter, testerFilter, dateFilter, sortOrder, sessionFilter])

  const testers = useMemo(
    () => [...new Set(bugs.flatMap((b) => b.tester.split(', ')))].sort(),
    [bugs],
  )

  const filtered = useMemo(() => {
    return bugs.filter((b) => {
      if (severityFilter === 'completed') { if (!b.reviewed) return false }
      else { if (b.reviewed) return false }
      if (severityFilter !== 'all' && severityFilter !== 'completed' && b.severity !== severityFilter) return false
      if (testerFilter !== 'all' && !b.tester.includes(testerFilter)) return false
      if (sessionFilter !== 'all') {
        const bugSessionId = b.session_id
        if (sessionFilter === 'none') { if (bugSessionId) return false }
        else if (bugSessionId !== sessionFilter) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !b.title.toLowerCase().includes(q) &&
          !(b.description || '').toLowerCase().includes(q) &&
          !b.id.toLowerCase().includes(q) &&
          !(b.category || '').toLowerCase().includes(q) &&
          !b.page.toLowerCase().includes(q)
        )
          return false
      }
      if (!matchesDateFilter(b.created_at, dateFilter)) return false
      return true
    }).sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      if (sortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      return 0
    })
  }, [bugs, severityFilter, search, testerFilter, dateFilter, sortOrder, sessionFilter])

  const activeBugs = useMemo(() => bugs.filter(b => !b.reviewed), [bugs])

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, low: 0 }
    activeBugs.forEach((b) => c[b.severity]++)
    return c
  }, [activeBugs])

  const nextIds = useMemo(() => ({
    critical: Math.max(0, ...bugs.filter((b) => b.severity === 'critical').map((b) => parseInt(b.id.replace(/\D+/g, '')) || 0)) + 1,
    high: Math.max(0, ...bugs.filter((b) => b.severity === 'high').map((b) => parseInt(b.id.replace(/\D+/g, '')) || 0)) + 1,
    low: Math.max(0, ...bugs.filter((b) => b.severity === 'low').map((b) => parseInt(b.id.replace(/\D+/g, '')) || 0)) + 1,
  }), [bugs])

  const grouped = useMemo(() => {
    const g: Record<string, Bug[]> = {}
    SEVERITIES.forEach((s) => { g[s] = filtered.filter((b) => b.severity === s) })
    return g
  }, [filtered])

  const filteredQuestions = useMemo(
    () => questions.filter((q) => matchesDateFilter(q.created_at, dateFilter)),
    [questions, dateFilter],
  )

  return {
    severityFilter,
    setSeverityFilter,
    search,
    setSearch,
    testerFilter,
    setTesterFilter,
    dateFilter,
    setDateFilter,
    sortOrder,
    setSortOrder,
    sessionFilter,
    setSessionFilter,
    testers,
    filtered,
    activeBugs,
    counts,
    nextIds,
    grouped,
    filteredQuestions,
  }
}
