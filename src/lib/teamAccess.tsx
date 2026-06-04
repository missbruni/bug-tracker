import React, { createContext, type ReactNode } from 'react'
import { supabase } from '../supabaseClient'
import {
  ACTIVE_TEAM_SESSION_KEY,
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_SLUG,
  ORGANIZATION_ID,
  slugifyTeamName,
  type TeamRecord,
} from './teamScope'
import { useAuth } from './useAuth'

interface TeamCreationResult {
  team: TeamRecord | null
  error: string | null
}

interface TeamMutationResult {
  error: string | null
}

type TeamRole = 'team_admin' | 'member' | null

interface TeamMembership {
  team_id: string
  role: Exclude<TeamRole, null>
  status: 'active'
}

interface TeamAccessContextValue {
  teams: TeamRecord[]
  activeTeamId: string | null
  activeTeam: TeamRecord | null
  allowedTeamIds: string[]
  manageableTeamIds: string[]
  teamRole: TeamRole
  isGodMode: boolean
  isTeamAdmin: boolean
  loading: boolean
  setActiveTeamId: (teamId: string) => void
  refreshTeams: () => Promise<void>
  createTeam: (name: string) => Promise<TeamCreationResult>
  updateTeam: (teamId: string, name: string) => Promise<TeamMutationResult>
  deleteTeam: (teamId: string) => Promise<TeamMutationResult>
  restoreTeam: (team: TeamRecord, makeActive?: boolean) => Promise<TeamMutationResult>
}

const defaultContextValue: TeamAccessContextValue = {
  teams: [],
  activeTeamId: null,
  activeTeam: null,
  allowedTeamIds: [],
  manageableTeamIds: [],
  teamRole: null,
  isGodMode: false,
  isTeamAdmin: false,
  loading: false,
  setActiveTeamId: () => {},
  refreshTeams: async () => {},
  createTeam: async () => ({
    team: null,
    error: 'Team context unavailable.',
  }),
  updateTeam: async () => ({ error: 'Team context unavailable.' }),
  deleteTeam: async () => ({ error: 'Team context unavailable.' }),
  restoreTeam: async () => ({ error: 'Team context unavailable.' }),
}

const TeamAccessContext = createContext<TeamAccessContextValue>(defaultContextValue)

function getStoredActiveTeamId(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACTIVE_TEAM_SESSION_KEY)
}

function setStoredActiveTeamId(teamId: string | null) {
  if (typeof window === 'undefined') return
  if (!teamId) {
    sessionStorage.removeItem(ACTIVE_TEAM_SESSION_KEY)
    return
  }
  sessionStorage.setItem(ACTIVE_TEAM_SESSION_KEY, teamId)
}

export function TeamAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [teams, setTeams] = React.useState<TeamRecord[]>([])
  const [teamMemberships, setTeamMemberships] = React.useState<TeamMembership[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTeamIdState, setActiveTeamIdState] = React.useState<string | null>(() => getStoredActiveTeamId())
  const [isAppOwner, setIsAppOwner] = React.useState(false)

  const refreshTeams = async () => {
    if (!supabase) {
      setTeams([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('teams')
      .select('id, organization_id, name, slug, created_at, timezone, default_product_id, backlog_key, default_backlog_provider')
      .eq('organization_id', ORGANIZATION_ID)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load teams:', error)
      setTeams([])
      setLoading(false)
      return
    }

    setTeams((data || []) as TeamRecord[])
    setLoading(false)
  }

  React.useEffect(() => {
    void refreshTeams()
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const fetchMemberships = async () => {
      if (!supabase || !user?.id) {
        if (!cancelled) setTeamMemberships([])
        return
      }
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (!cancelled) {
        if (error) {
          console.error('Failed to load team memberships:', error)
          setTeamMemberships([])
        } else {
          setTeamMemberships((data || []) as TeamMembership[])
        }
      }
    }
    void fetchMemberships()
    return () => { cancelled = true }
  }, [user?.id])

  React.useEffect(() => {
    let cancelled = false
    const fetchOwnerStatus = async () => {
      if (!supabase || !user?.id) {
        if (!cancelled) setIsAppOwner(false)
        return
      }
      const { data } = await supabase
        .from('app_owners')
        .select('user_id')
        .eq('user_id', user.id)
        .single()
      if (!cancelled) {
        setIsAppOwner(Boolean(data))
      }
    }
    void fetchOwnerStatus()
    return () => { cancelled = true }
  }, [user?.id])

  const isGodMode = isAppOwner
  const teamRole = teamMemberships.find((membership) => membership.team_id === activeTeamIdState)?.role ?? null
  const isTeamAdmin = isAppOwner || teamRole === 'team_admin'
  const fallbackTeam = teams.find((team) => team.slug === DEFAULT_TEAM_SLUG) || teams[0] || null

  const allowedTeamIds = React.useMemo(() => {
    if (!teams.length) return []
    if (isGodMode) return teams.map((team) => team.id)
    const memberTeamIds = new Set(teamMemberships.map((membership) => membership.team_id))
    const membershipTeamIds = teams.filter((team) => memberTeamIds.has(team.id)).map((team) => team.id)
    return membershipTeamIds.length ? membershipTeamIds : fallbackTeam ? [fallbackTeam.id] : []
  }, [teams, isGodMode, teamMemberships, fallbackTeam])

  const manageableTeamIds = React.useMemo(() => {
    if (!teams.length) return []
    if (isGodMode) return teams.map((team) => team.id)
    const adminTeamIds = new Set(teamMemberships.filter((membership) => membership.role === 'team_admin').map((membership) => membership.team_id))
    return teams.filter((team) => adminTeamIds.has(team.id)).map((team) => team.id)
  }, [teams, isGodMode, teamMemberships])

  React.useEffect(() => {
    if (!teams.length) {
      if (activeTeamIdState !== null) {
        setActiveTeamIdState(null)
        setStoredActiveTeamId(null)
      }
      return
    }

    const stored = getStoredActiveTeamId()

    if (isGodMode) {
      const preferred = [activeTeamIdState, stored, fallbackTeam?.id].find(
        (id): id is string => Boolean(id && teams.some((team) => team.id === id)),
      )

      const next = preferred || null
      if (next !== activeTeamIdState) {
        setActiveTeamIdState(next)
      }
      setStoredActiveTeamId(next)
      return
    }

    const preferred = [activeTeamIdState, stored, fallbackTeam?.id, allowedTeamIds[0]].find(
      (id): id is string => Boolean(id && allowedTeamIds.includes(id)),
    )
    const next = preferred || null
    if (next !== activeTeamIdState) {
      setActiveTeamIdState(next)
    }
    setStoredActiveTeamId(next)
  }, [teams, isGodMode, fallbackTeam, activeTeamIdState, allowedTeamIds])

  const setActiveTeamId = (teamId: string) => {
    if (!allowedTeamIds.includes(teamId)) return
    setActiveTeamIdState(teamId)
    setStoredActiveTeamId(teamId)
  }

  const createTeam = async (name: string): Promise<TeamCreationResult> => {
      if (!supabase) {
        return { team: null, error: 'Database is not connected.' }
      }

      const normalizedName = name.trim()
      if (!normalizedName) {
        return { team: null, error: 'Team name is required.' }
      }

      const baseSlug = slugifyTeamName(normalizedName)
      let slug = baseSlug
      let suffix = 2
      const existingSlugs = new Set(teams.map((team) => team.slug))
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`
        suffix += 1
      }

      const { data, error } = await supabase
        .from('teams')
        .insert({
          organization_id: ORGANIZATION_ID,
          name: normalizedName,
          slug,
        })
        .select('id, organization_id, name, slug, created_at, timezone, default_product_id, backlog_key, default_backlog_provider')
        .single()

      if (error || !data) {
        return { team: null, error: error?.message || 'Failed to create team.' }
      }

      const created = data as TeamRecord
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setTeamMemberships((prev) => [...prev.filter((membership) => membership.team_id !== created.id), { team_id: created.id, role: 'team_admin', status: 'active' }])
      setActiveTeamIdState(created.id)
      setStoredActiveTeamId(created.id)

      return { team: created, error: null }
  }

  const updateTeam = async (teamId: string, name: string): Promise<TeamMutationResult> => {
      if (!supabase) return { error: 'Database is not connected.' }
      if (!manageableTeamIds.includes(teamId)) return { error: 'Only team admins can update teams.' }

      const normalizedName = name.trim()
      if (!normalizedName) return { error: 'Team name is required.' }

      const newSlug = slugifyTeamName(normalizedName)
      const { error } = await supabase
        .from('teams')
        .update({ name: normalizedName, slug: newSlug })
        .eq('id', teamId)

      if (error) return { error: error.message }

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, name: normalizedName, slug: newSlug } : t)),
      )
      return { error: null }
  }

  const restoreTeam = async (team: TeamRecord, makeActive = false): Promise<TeamMutationResult> => {
      if (!supabase) return { error: 'Database is not connected.' }
      if (!isGodMode && !teamMemberships.some((membership) => membership.team_id === team.id && membership.role === 'team_admin')) return { error: 'Only team admins can restore teams.' }

      const { data, error } = await supabase
        .from('teams')
        .insert({
          id: team.id,
          organization_id: team.organization_id,
          name: team.name,
          slug: team.slug,
        })
        .select('id, organization_id, name, slug, created_at, timezone, default_product_id')
        .single()

      if (error || !data) {
        return { error: error?.message || 'Failed to restore team.' }
      }

      const restoredTeam = data as TeamRecord
      setTeams((prev) => [...prev, restoredTeam].sort((a, b) => a.name.localeCompare(b.name)))
      setTeamMemberships((prev) => [...prev.filter((membership) => membership.team_id !== restoredTeam.id), { team_id: restoredTeam.id, role: 'team_admin', status: 'active' }])

      if (makeActive) {
        setActiveTeamIdState(restoredTeam.id)
        setStoredActiveTeamId(restoredTeam.id)
      }

      return { error: null }
  }

  const deleteTeam = async (teamId: string): Promise<TeamMutationResult> => {
      if (!supabase) return { error: 'Database is not connected.' }
      if (!manageableTeamIds.includes(teamId)) return { error: 'Only team admins can delete teams.' }
      if (teamId === DEFAULT_TEAM_ID) return { error: 'Cannot delete the default team.' }

      const { error } = await supabase.from('teams').delete().eq('id', teamId)
      if (error) return { error: error.message }

      setTeams((prev) => prev.filter((t) => t.id !== teamId))

      if (activeTeamIdState === teamId) {
        const nextAllowedTeamId = allowedTeamIds.find((allowedTeamId) => allowedTeamId !== teamId) || null
        const fallback = nextAllowedTeamId ? teams.find((team) => team.id === nextAllowedTeamId) || null : null
        setActiveTeamIdState(fallback?.id || null)
        setStoredActiveTeamId(fallback?.id || null)
      }

      return { error: null }
  }

  const activeTeam = teams.find((team) => team.id === activeTeamIdState) || null

  const value: TeamAccessContextValue = {
    teams,
    activeTeamId: activeTeamIdState,
    activeTeam,
    allowedTeamIds,
    manageableTeamIds,
    teamRole,
    isGodMode,
    isTeamAdmin,
    loading,
    setActiveTeamId,
    refreshTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    restoreTeam,
  }

  return <TeamAccessContext.Provider value={value}>{children}</TeamAccessContext.Provider>
}

export function useTeamAccess() {
  return React.useContext(TeamAccessContext)
}
