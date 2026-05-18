import React from 'react'
import { supabase } from '../supabaseClient'
import { useTeamAccess } from '../lib/teamAccess'
import { scopeToTeam } from '../lib/teamScope'

export function useActiveBugCount(initialCount = 3): number {
  const [count, setCount] = React.useState(initialCount)
  const { activeTeamId } = useTeamAccess()

  React.useEffect(() => {
    if (!supabase) return
    const sb = supabase

    const fetchCount = async () => {
      const query = scopeToTeam(
        sb
        .from('bugs')
        .select('*', { count: 'exact', head: true })
        .eq('reviewed', false),
        activeTeamId,
      )

      const { count: c } = await query

      if (c !== null) setCount(c)
    }

    fetchCount()

    const changesConfig: {
      event: '*'
      schema: 'public'
      table: 'bugs'
      filter?: string
    } = { event: '*', schema: 'public', table: 'bugs' }

    if (activeTeamId) {
      changesConfig.filter = `team_id=eq.${activeTeamId}`
    }

    const channel = sb
      .channel(`layout-bugs-count:${activeTeamId ?? 'all'}`)
      .on(
        'postgres_changes',
        changesConfig,
        () => fetchCount(),
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [activeTeamId])

  return count
}
