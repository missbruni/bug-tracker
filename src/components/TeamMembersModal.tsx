import React from 'react'
import { X, UserPlus, Check, ChevronDown, Shield, User, Search, Mail, Clock, Trash2 } from 'lucide-react'
import { useTeamMembers } from '../domains/teams/useTeamMembers'
import type { TeamRole } from '../domains/teams/model'

interface TeamMembersModalProps {
  teamId: string
  teamName: string
  onClose: () => void
}

export default function TeamMembersModal({ teamId, teamName, onClose }: TeamMembersModalProps) {
  const {
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
  } = useTeamMembers(teamId)

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
                    onChange={(newRole) => handleRoleChange(member.id, newRole)}
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
                  onClick={resetAddMember}
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
