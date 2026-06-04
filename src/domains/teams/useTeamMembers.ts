import React from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../lib/useAuth'
import type { OrgUser, TeamInvitationRow, TeamMemberRow, TeamRole } from './model'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function useTeamMembers(teamId: string) {
  const { session, allowedEmailDomain, allowedEmailDomains } = useAuth()
  const [members, setMembers] = React.useState<TeamMemberRow[]>([])
  const [invitations, setInvitations] = React.useState<TeamInvitationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [orgUsers, setOrgUsers] = React.useState<OrgUser[]>([])
  const [showAdd, setShowAdd] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedUserIds, setSelectedUserIds] = React.useState<Set<string>>(new Set())
  const [adding, setAdding] = React.useState(false)
  const [inviting, setInviting] = React.useState(false)
  const [cancellingInvite, setCancellingInvite] = React.useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = React.useState<string | null>(null)

  const fetchMembers = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!supabase) return
    if (!opts?.silent) setLoading(true)
    const [membersRes, orgRes, invitesRes] = await Promise.all([
      supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .order('role'),
      supabase.rpc('get_org_users'),
      supabase
        .from('team_invitations')
        .select('id, email, role, created_at')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('created_at'),
    ])

    if (membersRes.error) {
      setError('Failed to load members.')
      setLoading(false)
      return
    }

    const userMap = new Map<string, OrgUser>()
    for (const user of (orgRes.data || []) as OrgUser[]) {
      userMap.set(user.id, user)
    }

    const enriched: TeamMemberRow[] = ((membersRes.data || []) as { id: string; user_id: string; role: TeamRole }[]).map((row) => {
      const info = userMap.get(row.user_id)
      return {
        id: row.id,
        user_id: row.user_id,
        email: info?.email ?? 'Unknown',
        display_name: info?.display_name ?? 'Unknown',
        avatar_url: info?.avatar_url ?? null,
        role: row.role,
      }
    })

    setMembers(enriched)
    setOrgUsers((orgRes.data || []) as OrgUser[])
    setInvitations((invitesRes.data || []) as TeamInvitationRow[])
    setLoading(false)
  }, [teamId])

  React.useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const adminCount = members.filter((member) => member.role === 'team_admin').length

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    if (!supabase) return
    const member = members.find((existingMember) => existingMember.id === memberId)
    if (!member) return

    if (member.role === 'team_admin' && newRole === 'member' && adminCount <= 1) {
      setError('Cannot demote the last team admin.')
      return
    }

    setUpdatingRole(memberId)
    setError(null)

    const { error: updateError } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (updateError) {
      setError('Failed to update role.')
    } else {
      setMembers((prev) =>
        prev.map((existingMember) => (existingMember.id === memberId ? { ...existingMember, role: newRole } : existingMember))
      )
    }
    setUpdatingRole(null)
  }

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const resetAddMember = () => {
    setShowAdd(false)
    setSearchQuery('')
    setSelectedUserIds(new Set())
  }

  const handleAddSelected = async () => {
    if (!supabase || selectedUserIds.size === 0) return
    setAdding(true)
    setError(null)

    const rows = Array.from(selectedUserIds).map((userId) => ({
      team_id: teamId, user_id: userId, role: 'member' as const, status: 'active' as const,
    }))

    const { error: insertError } = await supabase
      .from('team_members')
      .insert(rows)

    if (insertError) {
      setError('Failed to add members.')
    } else {
      const added: TeamMemberRow[] = Array.from(selectedUserIds).map((userId) => {
        const info = orgUsers.find((user) => user.id === userId)
        return { id: `optimistic-${userId}`, user_id: userId, email: info?.email ?? 'Unknown', display_name: info?.display_name ?? 'Unknown', avatar_url: info?.avatar_url ?? null, role: 'member' as const }
      })
      setMembers((prev) => [...prev, ...added])
      resetAddMember()
      void fetchMembers({ silent: true })
    }
    setAdding(false)
  }

  const handleInviteByEmail = async () => {
    const email = searchQuery.trim().toLowerCase()
    if (!email || !session?.access_token) return
    setInviting(true)
    setError(null)
    setInviteSuccess(null)

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ teamId, email }),
      })

      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Failed to send invitation.')
      } else {
        setInviteSuccess(`Invitation sent to ${email}`)
        setSearchQuery('')
        setInvitations((prev) => [...prev, { id: `optimistic-${Date.now()}`, email, role: 'member', created_at: new Date().toISOString() }])
        void fetchMembers({ silent: true })
      }
    } catch {
      setError('Failed to send invitation.')
    }
    setInviting(false)
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!supabase) return
    setCancellingInvite(inviteId)
    const { error: delError } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', inviteId)

    if (delError) {
      setError('Failed to cancel invitation.')
    } else {
      setInvitations((prev) => prev.filter((invitation) => invitation.id !== inviteId))
    }
    setCancellingInvite(null)
  }

  const memberUserIds = new Set(members.map((member) => member.user_id))
  const invitedEmails = new Set(invitations.map((invitation) => invitation.email.toLowerCase()))
  const availableUsers = orgUsers
    .filter((user) => !memberUserIds.has(user.id))
    .filter((user) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return user.email.toLowerCase().includes(query) || user.display_name.toLowerCase().includes(query)
    })

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isOrgEmail = isValidEmail(trimmedQuery) && allowedEmailDomains.some((domain) => trimmedQuery.endsWith(`@${domain}`))
  const alreadyMember = orgUsers.some((user) => user.email.toLowerCase() === trimmedQuery && memberUserIds.has(user.id))
  const alreadyInvited = invitedEmails.has(trimmedQuery)
  const canInvite = isOrgEmail && !alreadyMember && !alreadyInvited && availableUsers.length === 0

  return {
    members,
    invitations,
    loading,
    showAdd,
    setShowAdd,
    searchQuery,
    setSearchQuery,
    selectedUserIds,
    adding,
    inviting,
    cancellingInvite,
    updatingRole,
    error,
    setError,
    inviteSuccess,
    adminCount,
    availableUsers,
    trimmedQuery,
    alreadyMember,
    alreadyInvited,
    canInvite,
    allowedEmailDomain,
    toggleUser,
    resetAddMember,
    handleRoleChange,
    handleAddSelected,
    handleInviteByEmail,
    handleCancelInvite,
  }
}
