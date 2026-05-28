import React from 'react'
import { supabase } from '../supabaseClient'
import type { BugActivity } from '../components/BugActivityTimeline'
import type { TeamActivityRow, UnifiedActivity } from '../components/TeamActivityModal'

const FETCH_LIMIT = 100

export function useTeamActivity(teamId: string | null) {
  const [activities, setActivities] = React.useState<UnifiedActivity[]>([])
  const [loading, setLoading] = React.useState(false)
  const [existingSessionIds, setExistingSessionIds] = React.useState<Set<string>>(() => new Set())
  const [existingBugIds, setExistingBugIds] = React.useState<Set<string>>(() => new Set())

  React.useEffect(() => {
    if (!teamId || !supabase) {
      setActivities([])
      setExistingSessionIds(new Set())
      setExistingBugIds(new Set())
      return
    }

    const sb = supabase
    let cancelled = false

    const fetchActivities = async () => {
      setLoading(true)
      const [teamRes, bugRes, sessionsRes, bugsRes] = await Promise.all([
        sb
          .from('team_activity')
          .select('*')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT),
        sb
          .from('bug_activity')
          .select('*')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT),
        sb.from('sessions').select('id').eq('team_id', teamId),
        sb.from('bugs').select('id').eq('team_id', teamId),
      ])
      if (cancelled) return
      if (teamRes.error) console.error('Failed to fetch team activity:', teamRes.error)
      if (bugRes.error) console.error('Failed to fetch bug activity:', bugRes.error)
      if (sessionsRes.error) console.error('Failed to fetch sessions for activity link check:', sessionsRes.error)
      if (bugsRes.error) console.error('Failed to fetch bugs for activity link check:', bugsRes.error)
      const merged: UnifiedActivity[] = [
        ...((teamRes.data || []) as TeamActivityRow[]).map((row) => ({ kind: 'team' as const, ...row })),
        ...((bugRes.data || []) as BugActivity[]).map((row) => ({ kind: 'bug' as const, ...row })),
      ]
      merged.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      setActivities(merged.slice(0, FETCH_LIMIT))
      setExistingSessionIds(new Set(((sessionsRes.data || []) as Array<{ id: string }>).map((row) => row.id)))
      setExistingBugIds(new Set(((bugsRes.data || []) as Array<{ id: string }>).map((row) => row.id)))
      setLoading(false)
    }

    void fetchActivities()

    const channel = sb
      .channel(`team-activity-${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_activity', filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as TeamActivityRow
          setActivities((prev) => {
            if (prev.some((entry) => entry.kind === 'team' && entry.id === row.id)) return prev
            const next: UnifiedActivity[] = [{ kind: 'team', ...row }, ...prev]
            return next.slice(0, FETCH_LIMIT)
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bug_activity', filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as BugActivity
          setActivities((prev) => {
            if (prev.some((entry) => entry.kind === 'bug' && entry.id === row.id)) return prev
            const next: UnifiedActivity[] = [{ kind: 'bug', ...row }, ...prev]
            return next.slice(0, FETCH_LIMIT)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      sb.removeChannel(channel)
    }
  }, [teamId])

  return { activities, loading, existingSessionIds, existingBugIds }
}
