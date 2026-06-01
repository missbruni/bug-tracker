import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../supabaseClient'
import { useTeamAccess } from '../../lib/teamAccess'
import { useAuth } from '../../lib/useAuth'
import { getUserDisplayName } from '../../lib/userDisplayName'
import { scopeToTeam } from '../../lib/teamScope'

export const BUG_KILLS_QUERY_KEY = 'bug-kills'

export interface BugKillLeaderEntry {
  userId: string
  displayName: string
  avatarUrl?: string
  killCount: number
}

// ─── Flush a single kill directly to Supabase ────────────────

async function flushKill(
  teamId: string | null,
  userId: string | undefined,
  displayName: string,
  avatarUrl: string | undefined,
  onSuccess?: () => void,
) {
  if (!supabase) { console.warn('[bug-kills] supabase client is null'); return }
  if (!teamId)   { console.warn('[bug-kills] teamId is null/undefined'); return }
  if (!userId)   { console.warn('[bug-kills] userId is null/undefined'); return }
  const { error } = await supabase.rpc('increment_bug_kills', {
    p_team_id: teamId,
    p_user_id: userId,
    p_count: 1,
    p_display_name: displayName,
    p_avatar_url: avatarUrl ?? null,
  })
  if (error) {
    console.error('[bug-kills] flush error', error.message, error)
  } else {
    onSuccess?.()
  }
}

// ─── Hook: wires kill tracking to the current user/team ──────
// Returns a stable `kill` callback. Pass it down to any component
// that needs to record a kill (e.g. CrawlingBugs via NavBar).

export function useBugKillTracker() {
  const { activeTeamId } = useTeamAccess()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id
  const displayName = getUserDisplayName(user ?? null)
  const metadata = user?.user_metadata as Record<string, unknown> | undefined
  const avatarUrl = (typeof metadata?.avatar_url === 'string' ? metadata.avatar_url.trim() : '')
    || (typeof metadata?.picture === 'string' ? metadata.picture.trim() : '')
    || undefined

  // Stable refs so the callback identity never changes even when
  // team/user context updates between renders.
  const teamIdRef = React.useRef(activeTeamId)
  const userIdRef = React.useRef(userId)
  const displayNameRef = React.useRef(displayName)
  const avatarUrlRef = React.useRef(avatarUrl)
  teamIdRef.current = activeTeamId
  userIdRef.current = userId
  displayNameRef.current = displayName
  avatarUrlRef.current = avatarUrl

  const kill = React.useCallback(() => {
    void flushKill(
      teamIdRef.current,
      userIdRef.current,
      displayNameRef.current,
      avatarUrlRef.current,
      () => {
        void queryClient.invalidateQueries({ queryKey: [BUG_KILLS_QUERY_KEY, teamIdRef.current] })
      },
    )
  }, [queryClient])

  return { kill }
}

// ─── Hook: fetch leaderboard ─────────────────────────────────

export function useBugKillLeaderboard() {
  const { activeTeamId } = useTeamAccess()
  const queryClient = useQueryClient()

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: [BUG_KILLS_QUERY_KEY, activeTeamId],
    queryFn: async (): Promise<BugKillLeaderEntry[]> => {
      if (!supabase || !activeTeamId) return []

      const { data: kills } = await scopeToTeam(
        supabase
          .from('bug_kills')
          .select('user_id, kill_count, display_name, avatar_url')
          .order('kill_count', { ascending: false }),
        activeTeamId,
      )
      if (!kills?.length) return []

      type KillRow = { user_id: string; kill_count: number; display_name: string | null; avatar_url: string | null }
      return (kills as KillRow[]).map((row) => ({
        userId: row.user_id,
        displayName: row.display_name ?? row.user_id.slice(0, 8),
        avatarUrl: row.avatar_url ?? undefined,
        killCount: row.kill_count,
      }))
    },
    enabled: !!activeTeamId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [BUG_KILLS_QUERY_KEY, activeTeamId] })
  }, [queryClient, activeTeamId])

  return { leaderboard, isLoading, refresh }
}
