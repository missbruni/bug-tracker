import React from 'react'
import { supabase } from '../../supabaseClient'
import { useTeamAccess } from '../../lib/teamAccess'
import { scopeToTeam } from '../../lib/teamScope'
import type { BugActivity } from '../../components/BugActivityTimeline'

const ACTIVITY_LIMIT = 30

export function useBugActivity(bugId: string | null) {
  const [activities, setActivities] = React.useState<BugActivity[]>([])
  const [loading, setLoading] = React.useState(false)
  const { activeTeamId } = useTeamAccess()

  React.useEffect(() => {
    if (!bugId || !supabase) {
      setActivities([])
      return
    }

    const sb = supabase
    let cancelled = false
    const fetchActivities = async () => {
      setLoading(true)
      const query = scopeToTeam(
        sb
          .from('bug_activity')
          .select('*')
          .eq('bug_id', bugId)
          .order('created_at', { ascending: false })
          .limit(ACTIVITY_LIMIT),
        activeTeamId,
      )
      const { data, error } = await query
      if (!cancelled) {
        if (error) {
          console.error('Failed to fetch bug activity:', error)
        } else {
          setActivities((data || []) as BugActivity[])
        }
        setLoading(false)
      }
    }

    void fetchActivities()

    // Realtime subscription for this bug's activity
    const channel = sb
      .channel(`bug-activity-${bugId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bug_activity',
          filter: `bug_id=eq.${bugId}`,
        },
        (payload) => {
          const entry = payload.new as BugActivity
          if (activeTeamId && entry.team_id !== activeTeamId) return
          setActivities((prev) => {
            if (prev.some((existing) => existing.id === entry.id)) return prev
            return [entry, ...prev].slice(0, ACTIVITY_LIMIT)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      sb.removeChannel(channel)
    }
  }, [bugId, activeTeamId])

  return { activities, loading }
}
