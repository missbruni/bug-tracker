import React from 'react'
import { X, UserPlus, Check, ChevronDown, Shield, User, Search, Mail, Clock, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/useAuth'
import type { TeamRole } from '../types'

interface MemberRow {
  id: string
  user_id: string
  email: string
  display_name: string
  role: TeamRole
}

interface InvitedRow {
  id: string
  email: string
  role: TeamRole
  created_at: string
}

interface OrgUser {
  id: string
  email: string
  display_name: string
}

interface TeamMembersModalProps {
  teamId: string
  teamName: string
  onClose: () => void
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function TeamMembersModal({ teamId, teamName, onClose }: TeamMembersModalProps) {
  const { session, allowedEmailDomain, allowedEmailDomains } = useAuth()
  const [members, setMembers] = React.useState<MemberRow[]>([])
  const [invitations, setInvitations] = React.useState<InvitedRow[]>([])
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

    // Enrich with user info from get_org_users
    const userMap = new Map<string, OrgUser>()
    for (const user of (orgRes.data || []) as OrgUser[]) {
      userMap.set(user.id, user)
    }

    const enriched: MemberRow[] = ((membersRes.data || []) as { id: string; user_id: string; role: TeamRole }[]).map((row) => {
      const info = userMap.get(row.user_id)
      return {
        id: row.id,
        user_id: row.user_id,
        email: info?.email ?? 'Unknown',
        display_name: info?.display_name ?? 'Unknown',
        role: row.role,
      }
    })

    setMembers(enriched)
    setOrgUsers((orgRes.data || []) as OrgUser[])
    setInvitations((invitesRes.data || []) as InvitedRow[])
    setLoading(false)
  }, [teamId])

  React.useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const adminCount = members.filter((member) => member.role === 'team_admin').length

  const handleRoleChange = async (memberId: string, userId: string, newRole: TeamRole) => {
    if (!supabase) return
    const member = members.find((mem) => mem.id === memberId)
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
        prev.map((mem) => (mem.id === memberId ? { ...mem, role: newRole } : mem))
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
      // Optimistic: move selected users into the members list immediately
      const added: MemberRow[] = Array.from(selectedUserIds).map((userId) => {
        const info = orgUsers.find((u) => u.id === userId)
        return { id: `optimistic-${userId}`, user_id: userId, email: info?.email ?? 'Unknown', display_name: info?.display_name ?? 'Unknown', role: 'member' as const }
      })
      setMembers((prev) => [...prev, ...added])
      setSelectedUserIds(new Set())
      setSearchQuery('')
      setShowAdd(false)
      // Background sync to get real ids
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
        // Optimistic: show the invitation immediately
        setInvitations((prev) => [...prev, { id: `optimistic-${Date.now()}`, email, role: 'member', created_at: new Date().toISOString() }])
        // Background sync to get the real id
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
      setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId))
    }
    setCancellingInvite(null)
  }

  const memberUserIds = new Set(members.map((member) => member.user_id))
  const invitedEmails = new Set(invitations.map((inv) => inv.email.toLowerCase()))
  const availableUsers = orgUsers
    .filter((user) => !memberUserIds.has(user.id))
    .filter((user) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return user.email.toLowerCase().includes(query) || user.display_name.toLowerCase().includes(query)
    })

  // Determine if the search query is an invitable email
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isOrgEmail = isValidEmail(trimmedQuery) && allowedEmailDomains.some((d) => trimmedQuery.endsWith(`@${d}`))
  const alreadyMember = orgUsers.some((u) => u.email.toLowerCase() === trimmedQuery && memberUserIds.has(u.id))
  const alreadyInvited = invitedEmails.has(trimmedQuery)
  const canInvite = isOrgEmail && !alreadyMember && !alreadyInvited && availableUsers.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Team Members</h2>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{teamName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-gray-600">Loading members...</div>
          ) : members.length === 0 && invitations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-gray-600 italic">No members found.</div>
          ) : (
            <>
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-gray-300 uppercase">
                      {member.display_name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">{member.display_name}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{member.email}</p>
                  </div>
                  <RoleDropdown
                    role={member.role}
                    disabled={updatingRole === member.id || (member.role === 'team_admin' && adminCount <= 1)}
                    loading={updatingRole === member.id}
                    onChange={(newRole) => handleRoleChange(member.id, member.user_id, newRole)}
                  />
                </div>
              ))}
              {invitations.map((inv) => (
                <div
                  key={`inv-${inv.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-70"
                >
                  <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Mail size={14} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">{inv.email}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={10} /> Invited
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    disabled={cancellingInvite === inv.id}
                    className="p-1.5 text-slate-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                    title="Cancel invitation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Add member section */}
        <div className="border-t border-slate-100 dark:border-gray-800 p-5 pt-3">
          {showAdd ? (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-mushi-primary/40"
                />
              </div>
              {/* Inline feedback — close to the action */}
              {error && <div className="alert alert-error">{error}</div>}
              {inviteSuccess && <div className="alert alert-success">{inviteSuccess}</div>}
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {availableUsers.length === 0 ? (
                  canInvite ? (
                    <div className="py-3 text-center space-y-2">
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        <span className="font-medium text-slate-700 dark:text-gray-300">{trimmedQuery}</span> hasn&apos;t joined yet.
                      </p>
                      <button
                        onClick={handleInviteByEmail}
                        disabled={inviting}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 dark:bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 dark:hover:bg-amber-500 disabled:opacity-40 disabled:cursor-default cursor-pointer transition-colors"
                      >
                        <Mail size={13} />
                        {inviting ? 'Sending...' : 'Send invite'}
                      </button>
                    </div>
                  ) : inviteSuccess ? null : (
                    <p className="py-3 text-center text-xs text-slate-400 dark:text-gray-600 italic">
                      {searchQuery
                        ? alreadyInvited
                          ? 'This user has already been invited.'
                          : alreadyMember
                            ? 'This user is already a member.'
                            : `No matching users found.${trimmedQuery.includes('@') ? '' : ` Type a full @${allowedEmailDomain} email to invite.`}`
                        : 'All org users are already members.'}
                    </p>
                  )
                ) : (
                  availableUsers.map((user) => {
                    const selected = selectedUserIds.has(user.id)
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer
                          ${selected
                            ? 'bg-teal-50 dark:bg-mushi-primary/10 border border-teal-300 dark:border-mushi-primary/30'
                            : 'hover:bg-slate-50 dark:hover:bg-gray-800/50 border border-transparent'
                          }`}
                      >
                        <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                          ${selected
                            ? 'bg-teal-500 dark:bg-mushi-primary border-teal-500 dark:border-mushi-primary'
                            : 'border-slate-300 dark:border-gray-600'
                          }`}
                        >
                          {selected && <Check size={12} className="text-white dark:text-mushi-bg" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">{user.display_name}</p>
                          <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{user.email}</p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => { setShowAdd(false); setSearchQuery(''); setSelectedUserIds(new Set()) }}
                  className="flex-1 text-center rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSelected}
                  disabled={selectedUserIds.size === 0 || adding}
                  className="flex-1 rounded-lg bg-teal-500 dark:bg-mushi-primary px-3 py-2 text-xs font-bold text-white dark:text-mushi-bg hover:bg-teal-600 dark:hover:bg-mushi-primary/80 disabled:opacity-40 disabled:cursor-default cursor-pointer transition-colors"
                >
                  {adding ? 'Adding...' : `Add ${selectedUserIds.size > 0 ? selectedUserIds.size : ''} member${selectedUserIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowAdd(true); setError(null) }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-gray-700 py-2.5 text-xs font-medium text-slate-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 dark:hover:border-mushi-primary/50 dark:hover:text-mushi-primary transition-colors cursor-pointer"
            >
              <UserPlus size={14} />
              Add member
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RoleDropdown({
  role,
  disabled,
  loading,
  onChange,
}: {
  role: TeamRole
  disabled: boolean
  loading: boolean
  onChange: (role: TeamRole) => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isAdmin = role === 'team_admin'
  const Icon = isAdmin ? Shield : User
  const label = isAdmin ? 'Admin' : 'Member'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (!disabled && !loading) setOpen(!open) }}
        disabled={disabled || loading}
        className={`badge ${isAdmin ? 'badge-green' : 'badge-slate'} cursor-pointer
          ${disabled ? 'opacity-50 cursor-default' : 'hover:bg-slate-100 dark:hover:bg-gray-700'}
        `}
      >
        <Icon size={12} />
        {loading ? '...' : label}
        {!disabled && <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-10 py-1">
          <button
            onClick={() => { onChange('team_admin'); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer transition-colors
              ${isAdmin ? 'bg-teal-50 dark:bg-mushi-primary/10 text-teal-600 dark:text-mushi-primary font-semibold' : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800'}
            `}
          >
            <Shield size={12} /> Admin
          </button>
          <button
            onClick={() => { onChange('member'); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer transition-colors
              ${!isAdmin ? 'bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 font-semibold' : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800'}
            `}
          >
            <User size={12} /> Member
          </button>
        </div>
      )}
    </div>
  )
}
