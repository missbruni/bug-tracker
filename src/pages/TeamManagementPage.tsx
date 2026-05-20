import React from 'react'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import SecondaryAppBar from '../components/SecondaryAppBar'
import TeamCard, { type Product, type ProductLink, type TeamStats } from '../components/TeamCard'
import TeamMembersModal from '../components/TeamMembersModal'
import { useTeamAccess } from '../lib/teamAccess'
import { DEFAULT_TEAM_ID, slugifyTeamName } from '../lib/teamScope'
import { supabase } from '../supabaseClient'
import { TeamListSkeleton } from '../components/Skeleton'

export default function TeamManagementPage() {
  const {
    teams,
    activeTeamId,
    isTeamAdmin,
    loading,
    setActiveTeamId,
    refreshTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    restoreTeam,
  } = useTeamAccess()

  const [showAdd, setShowAdd] = React.useState(false)
  const [newTeamName, setNewTeamName] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [toast, setToast] = React.useState<{
    message: string
    tone: 'success' | 'error'
    undo?: () => Promise<void> | void
  } | null>(null)
  const [teamStats, setTeamStats] = React.useState<Record<string, TeamStats>>({})
  const [products, setProducts] = React.useState<Product[]>([])
  const [memberModalTeamId, setMemberModalTeamId] = React.useState<string | null>(null)
  const [statsVersion, setStatsVersion] = React.useState(0)

  React.useEffect(() => {
    const loadTeamStats = async () => {
      if (!supabase || !teams.length) return
      const [testersRes, sessionsRes, bugsRes, productsRes, membersRes] = await Promise.all([
        supabase.from('testers').select('team_id, active'),
        supabase.from('sessions').select('team_id'),
        supabase.from('bugs').select('team_id, reviewed'),
        supabase.from('products').select('id, team_id, name, slug, description, link, links'),
        supabase.from('team_members').select('team_id').eq('status', 'active'),
      ])
      const stats: Record<string, TeamStats> = {}
      const ensure = (id: string) => { if (!stats[id]) stats[id] = { testers: 0, activeTesters: 0, sessions: 0, activeBugs: 0, members: 0 } }
      for (const row of (testersRes.data || []) as Array<{ team_id: string; active: boolean }>) {
        ensure(row.team_id); stats[row.team_id].testers++
        if (row.active) stats[row.team_id].activeTesters++
      }
      for (const row of (sessionsRes.data || []) as Array<{ team_id: string }>) {
        ensure(row.team_id); stats[row.team_id].sessions++
      }
      for (const row of (bugsRes.data || []) as Array<{ team_id: string; reviewed: boolean }>) {
        ensure(row.team_id)
        if (!row.reviewed) stats[row.team_id].activeBugs++
      }
      for (const row of (membersRes.data || []) as Array<{ team_id: string }>) {
        ensure(row.team_id); stats[row.team_id].members++
      }
      setTeamStats(stats)
      setProducts((productsRes.data || []) as Product[])
    }

    void loadTeamStats()
  }, [teams.length, statsVersion])

  // Refresh when AI creates a team or product
  React.useEffect(() => {
    const handler = () => {
      void refreshTeams()
    }
    window.addEventListener('teamDataChanged', handler)
    return () => window.removeEventListener('teamDataChanged', handler)
  }, [refreshTeams])

  const handleAddProduct = async (teamId: string, product: { name: string; description?: string; links?: ProductLink[] }) => {
    if (!supabase) return
    const slug = slugifyTeamName(product.name)
    const links = product.links?.length ? product.links : []
    const { data, error: err } = await supabase
      .from('products')
      .insert({ team_id: teamId, name: product.name, slug, description: product.description || null, link: links[0]?.url || null, links })
      .select('id, team_id, name, slug, description, link, links')
      .single()
    if (err) {
      setToast({ message: err.message, tone: 'error' })
    } else if (data) {
      setProducts((prev) => [...prev, data as Product])
    }
  }

  const handleUpdateProduct = async (productId: string, product: { name: string; description?: string; links?: ProductLink[] }) => {
    if (!supabase) return
    const slug = slugifyTeamName(product.name)
    const links = product.links?.length ? product.links : []
    const { error: err } = await supabase
      .from('products')
      .update({ name: product.name, slug, description: product.description || null, link: links[0]?.url || null, links })
      .eq('id', productId)
    if (err) {
      setToast({ message: err.message, tone: 'error' })
    } else {
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, name: product.name, slug, description: product.description || null, link: links[0]?.url || null, links } : p))
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!supabase) return
    const { error: err } = await supabase.from('products').delete().eq('id', productId)
    if (err) {
      setToast({ message: err.message, tone: 'error' })
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== productId))
    }
  }

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name))

  const filteredTeams = (() => {
    const query = search.trim().toLowerCase()
    if (!query) return sortedTeams
    return sortedTeams.filter(
      (team) => team.name.toLowerCase().includes(query) || team.slug.toLowerCase().includes(query),
    )
  })()

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || creating) return
    setCreating(true)
    setError(null)
    const result = await createTeam(newTeamName)
    if (result.error) {
      setError(result.error)
      setCreating(false)
      return
    }
    setNewTeamName('')
    setShowAdd(false)
    setCreating(false)
  }

  const startEdit = (team: { id: string; name: string }) => {
    setEditingId(team.id)
    setEditName(team.name)
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    const result = await updateTeam(editingId, editName)
    if (result.error) {
      setToast({ message: result.error, tone: 'error' })
    } else {
      setEditingId(null)
    }
  }

  const confirmDelete = async (teamId: string) => {
    if (deletingId) return
    setDeletingId(teamId)
    const deletedTeam = teams.find((team) => team.id === teamId) || null
    const wasActiveTeam = activeTeamId === teamId
    const result = await deleteTeam(teamId)
    if (result.error) {
      setToast({ message: result.error, tone: 'error' })
    } else {
      setToast({
        message: 'Team deleted.',
        tone: 'success',
        undo: deletedTeam
          ? async () => {
            const restoreResult = await restoreTeam(deletedTeam, wasActiveTeam)
            if (restoreResult.error) {
              setToast({ message: restoreResult.error, tone: 'error' })
              return
            }
            setToast({ message: 'Team restored.', tone: 'success' })
          }
          : undefined,
      })
    }
    setDeletingId(null)
    setPendingDeleteId(null)
  }

  return (
    <>
      <SecondaryAppBar
        description=""
        stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{teams.length} teams</span> configured</>}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams..."
        actionButton={
          <button
            onClick={() => { setShowAdd(true); setError(null) }}
            className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            Create Team
          </button>
        }
      />

      <div className="max-w-screen-lg mx-auto px-4 sm:px-7 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase tracking-tight">Teams</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Create and manage teams across the organization. Click on a team to set it as active.</p>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">New team name</label>
            <input
              autoFocus
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleCreateTeam(); if (event.key === 'Escape') { setShowAdd(false); setNewTeamName(''); setError(null) } }}
              placeholder="e.g. Revenue Ops"
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            />
            {error && (
              <p className="mt-2 text-xs text-red-500" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || creating}
                className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewTeamName(''); setError(null) }}
                className="rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <TeamListSkeleton />
        ) : filteredTeams.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-gray-500">No teams found yet.</div>
        ) : (
          <div className="space-y-2">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isActive={activeTeamId === team.id}
                isDefault={team.id === DEFAULT_TEAM_ID}
                stats={teamStats[team.id]}
                products={products.filter((p) => p.team_id === team.id)}
                canEdit={isTeamAdmin}
                onManageMembers={isTeamAdmin ? () => setMemberModalTeamId(team.id) : undefined}
                onSelect={() => setActiveTeamId(team.id)}
                onStartEdit={() => startEdit(team)}
                onDelete={() => { if (!deletingId) setPendingDeleteId(team.id) }}
                onAddProduct={(product) => handleAddProduct(team.id, product)}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                isEditing={editingId === team.id}
                editName={editName}
                onEditNameChange={setEditName}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                pendingDelete={pendingDeleteId === team.id}
                deleting={deletingId === team.id}
                onConfirmDelete={() => { void confirmDelete(team.id) }}
                onCancelDelete={() => setPendingDeleteId(null)}
              />
            ))}
          </div>
        )}

        {memberModalTeamId && (
          <TeamMembersModal
            teamId={memberModalTeamId}
            teamName={teams.find((t) => t.id === memberModalTeamId)?.name ?? ''}
            onClose={() => { setMemberModalTeamId(null); setStatsVersion((v) => v + 1) }}
          />
        )}

        {toast && (
          <div className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg bg-white dark:bg-mushi-surface border-slate-200 dark:border-gray-700 ${toast.tone === 'success' ? 'text-teal-600 dark:text-mushi-primary' : 'text-red-600 dark:text-red-400'}`}>
            {toast.tone === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
            {toast.message}
            {toast.undo && (
              <button
                onClick={() => {
                  const undo = toast.undo
                  if (!undo) return
                  setToast(null)
                  void undo()
                }}
                className="rounded-md bg-teal-50 dark:bg-mushi-primary/10 px-2.5 py-1 text-xs font-bold text-teal-700 dark:text-mushi-primary hover:bg-teal-100 dark:hover:bg-mushi-primary/20 transition-colors cursor-pointer"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
