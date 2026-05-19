import React, { createContext, type ReactNode } from 'react'
import { supabase } from '../supabaseClient'
import {
  ACTIVE_TEAM_SESSION_KEY,
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_SLUG,
  ORGANIZATION_ID,
  slugifyTeamName,
  type PinAccessLevel,
  type TeamRecord,
} from './teamScope'
import { cachePinRole, fetchPinSession } from './pinAuth'
import { useAuth } from './useAuth'

interface TeamCreationResult {
  team: TeamRecord | null
  error: string | null
}

interface TeamMutationResult {
  error: string | null
}

interface TeamAccessContextValue {
  teams: TeamRecord[]
  activeTeamId: string | null
  activeTeam: TeamRecord | null
  allowedTeamIds: string[]
  pinRole: PinAccessLevel | null
  isGodMode: boolean
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
  pinRole: null,
  isGodMode: false,
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
  const [loading, setLoading] = React.useState(true)
  const [pinRole, setPinRole] = React.useState<PinAccessLevel | null>(null)
  const [activeTeamIdState, setActiveTeamIdState] = React.useState<string | null>(() => getStoredActiveTeamId())

  const refreshTeams = async () => {
    if (!supabase) {
      setTeams([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('teams')
      .select('id, organization_id, name, slug, created_at')
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

    const updatePinRole = async () => {
      try {
        const session = await fetchPinSession()
        if (cancelled) return
        const role = session.authenticated ? session.role : null
        setPinRole(role)
        cachePinRole(role)
      } catch {
        if (cancelled) return
        setPinRole(null)
        cachePinRole(null)
      }
    }

    void updatePinRole()
    const triggerUpdate = () => {
      void updatePinRole()
    }
    window.addEventListener('pin-unlocked', triggerUpdate)
    window.addEventListener('pin-lock', triggerUpdate)

    return () => {
      cancelled = true
      window.removeEventListener('pin-unlocked', triggerUpdate)
      window.removeEventListener('pin-lock', triggerUpdate)
    }
  }, [])

  const ownerEmails = (import.meta.env.VITE_APP_OWNER_EMAILS as string || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const isAppOwner = Boolean(user?.email && ownerEmails.includes(user.email.toLowerCase()))

  const isGodMode = pinRole === 'god' || isAppOwner
  const fallbackTeam = teams.find((team) => team.slug === DEFAULT_TEAM_SLUG) || teams[0] || null

  const allowedTeamIds = (() => {
    if (!teams.length) return []
    if (isGodMode) return teams.map((team) => team.id)
    return fallbackTeam ? [fallbackTeam.id] : []
  })()

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

    const next = fallbackTeam?.id || null
    if (next !== activeTeamIdState) {
      setActiveTeamIdState(next)
    }
    setStoredActiveTeamId(next)
  }, [teams, isGodMode, fallbackTeam, activeTeamIdState])

  const setActiveTeamId = (teamId: string) => {
    if (!isGodMode) return
    if (!teams.some((team) => team.id === teamId)) return
    setActiveTeamIdState(teamId)
    setStoredActiveTeamId(teamId)
  }

  const createTeam = async (name: string): Promise<TeamCreationResult> => {
      if (!supabase) {
        return { team: null, error: 'Database is not connected.' }
      }

      if (!isGodMode) {
        return { team: null, error: 'Only god mode can create teams.' }
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
        .select('id, organization_id, name, slug, created_at')
        .single()

      if (error || !data) {
        return { team: null, error: error?.message || 'Failed to create team.' }
      }

      const created = data as TeamRecord
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setActiveTeamIdState(created.id)
      setStoredActiveTeamId(created.id)

      return { team: created, error: null }
  }

  const updateTeam = async (teamId: string, name: string): Promise<TeamMutationResult> => {
      if (!supabase) return { error: 'Database is not connected.' }
      if (!isGodMode) return { error: 'Only god mode can update teams.' }

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
      if (!isGodMode) return { error: 'Only god mode can restore teams.' }

      const { data, error } = await supabase
        .from('teams')
        .insert({
          id: team.id,
          organization_id: team.organization_id,
          name: team.name,
          slug: team.slug,
        })
        .select('id, organization_id, name, slug, created_at')
        .single()

      if (error || !data) {
        return { error: error?.message || 'Failed to restore team.' }
      }

      const restoredTeam = data as TeamRecord
      setTeams((prev) => [...prev, restoredTeam].sort((a, b) => a.name.localeCompare(b.name)))

      if (makeActive) {
        setActiveTeamIdState(restoredTeam.id)
        setStoredActiveTeamId(restoredTeam.id)
      }

      return { error: null }
  }

  const deleteTeam = async (teamId: string): Promise<TeamMutationResult> => {
      if (!supabase) return { error: 'Database is not connected.' }
      if (!isGodMode) return { error: 'Only god mode can delete teams.' }
      if (teamId === DEFAULT_TEAM_ID) return { error: 'Cannot delete the default team.' }

      const { error } = await supabase.from('teams').delete().eq('id', teamId)
      if (error) return { error: error.message }

      setTeams((prev) => prev.filter((t) => t.id !== teamId))

      if (activeTeamIdState === teamId) {
        const fallback = teams.find((t) => t.slug === DEFAULT_TEAM_SLUG && t.id !== teamId) || teams.find((t) => t.id !== teamId) || null
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
    pinRole,
    isGodMode,
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
