import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import { useTeamAccess } from '../../lib/teamAccess'
import { scopeToTeam } from '../../lib/teamScope'
import type { Severity } from '../../constants'

// ─── Types ───────────────────────────────────────────────────

export type TimePreset = '7d' | '30d' | '90d'

export interface BugTrendPoint {
  date: string
  label: string
  critical: number
  high: number
  low: number
  total: number
}

export interface TesterPerformanceEntry {
  tester: string
  critical: number
  high: number
  low: number
  total: number
}

export interface SessionStatusBreakdown {
  draft: number
  active: number
  completed: number
  total: number
}

export interface SessionBugEntry {
  sessionName: string
  bugCount: number
}

export interface StatCard {
  label: string
  value: string | number
  detail?: string
}

interface RawBug {
  id: string
  severity: Severity
  tester: string
  reviewed: boolean
  created_at: string
  session_id: string | null
}

interface RawSession {
  id: string
  name: string
  status: string
  created_at: string
}

interface RawFeedback {
  session_id: string
  rating: number
}

// ─── Helpers ─────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function presetToDays(preset: TimePreset): number {
  return preset === '7d' ? 7 : preset === '30d' ? 30 : 90
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const dayOfWeek = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00')
  return `W ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function toDateKey(isoString: string): string {
  return isoString.slice(0, 10)
}

// ─── Hook ────────────────────────────────────────────────────

export default function useAnalytics(preset: TimePreset) {
  const { activeTeamId } = useTeamAccess()
  const days = presetToDays(preset)
  const useWeekly = preset === '90d'

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', activeTeamId, preset],
    queryFn: async () => {
      if (!supabase || !activeTeamId) {
        return { bugs: [] as RawBug[], sessions: [] as RawSession[], feedback: [] as RawFeedback[] }
      }

      const cutoff = daysAgo(days).toISOString()

      const [bugsResult, allBugsResult, sessionsResult, feedbackResult] = await Promise.all([
        // Bugs within time range (for trends)
        scopeToTeam(
          supabase.from('bugs').select('id, severity, tester, reviewed, created_at, session_id').gte('created_at', cutoff).order('created_at'),
          activeTeamId,
        ),
        // All bugs (for stat totals and tester performance)
        scopeToTeam(
          supabase.from('bugs').select('id, severity, tester, reviewed, created_at, session_id'),
          activeTeamId,
        ),
        // All sessions
        scopeToTeam(
          supabase.from('sessions').select('id, name, status, created_at'),
          activeTeamId,
        ),
        // Session feedback
        scopeToTeam(
          supabase.from('session_feedback').select('session_id, rating'),
          activeTeamId,
        ),
      ])

      return {
        bugs: (bugsResult.data ?? []) as RawBug[],
        allBugs: (allBugsResult.data ?? []) as RawBug[],
        sessions: (sessionsResult.data ?? []) as RawSession[],
        feedback: (feedbackResult.data ?? []) as RawFeedback[],
      }
    },
    enabled: !!activeTeamId,
    staleTime: 60_000,
  })

  const bugs = React.useMemo(() => data?.bugs ?? [], [data])
  const allBugs = React.useMemo(() => data?.allBugs ?? [], [data])
  const sessions = React.useMemo(() => data?.sessions ?? [], [data])
  const feedback = React.useMemo(() => data?.feedback ?? [], [data])

  // ─── Bug Trends ──────────────────────────────────────────

  const bugTrends = React.useMemo((): BugTrendPoint[] => {
    if (!bugs.length) return []

    // Build date buckets
    const bucketMap = new Map<string, { critical: number; high: number; low: number }>()

    if (useWeekly) {
      for (const bug of bugs) {
        const weekKey = getWeekLabel(toDateKey(bug.created_at))
        const bucket = bucketMap.get(weekKey) ?? { critical: 0, high: 0, low: 0 }
        bucket[bug.severity] += 1
        bucketMap.set(weekKey, bucket)
      }

      // Fill missing weeks
      const start = daysAgo(days)
      const today = new Date()
      const current = new Date(start)
      const dayOfWeek = current.getDay()
      current.setDate(current.getDate() - ((dayOfWeek + 6) % 7))

      while (current <= today) {
        const key = current.toISOString().slice(0, 10)
        if (!bucketMap.has(key)) {
          bucketMap.set(key, { critical: 0, high: 0, low: 0 })
        }
        current.setDate(current.getDate() + 7)
      }
    } else {
      for (const bug of bugs) {
        const dateKey = toDateKey(bug.created_at)
        const bucket = bucketMap.get(dateKey) ?? { critical: 0, high: 0, low: 0 }
        bucket[bug.severity] += 1
        bucketMap.set(dateKey, bucket)
      }

      // Fill missing days
      const start = daysAgo(days)
      const today = new Date()
      const current = new Date(start)
      while (current <= today) {
        const key = current.toISOString().slice(0, 10)
        if (!bucketMap.has(key)) {
          bucketMap.set(key, { critical: 0, high: 0, low: 0 })
        }
        current.setDate(current.getDate() + 1)
      }
    }

    return Array.from(bucketMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, counts]) => ({
        date,
        label: useWeekly ? formatWeekLabel(date) : formatDateLabel(date),
        ...counts,
        total: counts.critical + counts.high + counts.low,
      }))
  }, [bugs, days, useWeekly])

  // ─── Tester Performance ──────────────────────────────────

  const testerPerformance = React.useMemo((): TesterPerformanceEntry[] => {
    const testerMap = new Map<string, { critical: number; high: number; low: number }>()

    for (const bug of allBugs) {
      const name = bug.tester || 'Unknown'
      const entry = testerMap.get(name) ?? { critical: 0, high: 0, low: 0 }
      entry[bug.severity] += 1
      testerMap.set(name, entry)
    }

    return Array.from(testerMap.entries())
      .map(([tester, counts]) => ({
        tester,
        ...counts,
        total: counts.critical + counts.high + counts.low,
      }))
      .sort((entryA, entryB) => entryB.total - entryA.total)
  }, [allBugs])

  // ─── Session Analytics ───────────────────────────────────

  const sessionStatus = React.useMemo((): SessionStatusBreakdown => {
    const counts = { draft: 0, active: 0, completed: 0, total: sessions.length }
    for (const session of sessions) {
      if (session.status === 'draft') counts.draft += 1
      else if (session.status === 'active') counts.active += 1
      else if (session.status === 'completed') counts.completed += 1
    }
    return counts
  }, [sessions])

  const sessionBugs = React.useMemo((): SessionBugEntry[] => {
    const sessionMap = new Map<string, string>()
    for (const session of sessions) {
      sessionMap.set(session.id, session.name)
    }

    const countMap = new Map<string, number>()
    for (const bug of allBugs) {
      if (bug.session_id && sessionMap.has(bug.session_id)) {
        countMap.set(bug.session_id, (countMap.get(bug.session_id) ?? 0) + 1)
      }
    }

    return Array.from(countMap.entries())
      .map(([sessionId, bugCount]) => ({
        sessionName: sessionMap.get(sessionId) ?? sessionId,
        bugCount,
      }))
      .sort((entryA, entryB) => entryB.bugCount - entryA.bugCount)
      .slice(0, 10)
  }, [allBugs, sessions])

  const avgFeedbackRating = React.useMemo((): number | null => {
    if (!feedback.length) return null
    const sum = feedback.reduce((acc, entry) => acc + entry.rating, 0)
    return Math.round((sum / feedback.length) * 10) / 10
  }, [feedback])

  // ─── Stat Cards ──────────────────────────────────────────

  const statCards = React.useMemo((): StatCard[] => {
    const totalBugs = allBugs.length
    const criticalCount = allBugs.filter((bug) => bug.severity === 'critical').length
    const reviewedCount = allBugs.filter((bug) => bug.reviewed).length
    const reviewRate = totalBugs > 0 ? Math.round((reviewedCount / totalBugs) * 100) : 0
    const bugsInRange = bugs.length
    const avgPerDay = days > 0 ? Math.round((bugsInRange / days) * 10) / 10 : 0
    const completionRate = sessions.length > 0
      ? Math.round((sessionStatus.completed / sessions.length) * 100)
      : 0

    return [
      { label: 'Total Bugs', value: totalBugs, detail: `${criticalCount} critical` },
      { label: 'Review Rate', value: `${reviewRate}%`, detail: `${reviewedCount} of ${totalBugs}` },
      { label: 'Bugs / Day', value: avgPerDay, detail: `Last ${days}d` },
      { label: 'Sessions', value: sessions.length, detail: `${completionRate}% completed` },
      { label: 'Avg Feedback', value: avgFeedbackRating ?? '—', detail: feedback.length ? `${feedback.length} ratings` : 'No feedback' },
      { label: 'Active Testers', value: testerPerformance.length, detail: testerPerformance[0] ? `Top: ${testerPerformance[0].tester}` : '' },
    ]
  }, [allBugs, bugs, sessions, feedback, testerPerformance, sessionStatus, avgFeedbackRating, days])

  return {
    isLoading,
    bugTrends,
    testerPerformance,
    sessionStatus,
    sessionBugs,
    avgFeedbackRating,
    statCards,
  }
}
