import React from 'react'
import { Columns3, GitBranch, Plus } from 'lucide-react'
import BacklogCard from '../components/BacklogCard'
import BacklogFiltersBar from '../components/BacklogFiltersBar'
import BacklogItemDetailModal from '../components/BacklogItemDetailModal'
import NewBacklogItemModal from '../components/NewBacklogItemModal'
import SecondaryAppBar from '../components/SecondaryAppBar'
import PageLoader from '../components/PageLoader'
import { useBacklog, calculateInsertSortOrder } from '../domains/backlog/useBacklog'
import { PRIORITY_LABELS, PRIORITY_STYLES } from '../domains/backlog/display'
import { itemMatchesFilters, type BacklogFilters } from '../domains/backlog/filters'
import { useTeamAccess } from '../lib/teamAccess'
import { useNotificationStore } from '../stores/notificationStore'

type ViewMode = 'kanban' | 'grouped'

export default function BacklogPage() {
  const { isTeamAdmin } = useTeamAccess()
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => (sessionStorage.getItem('backlog-view-mode') as ViewMode) || 'kanban')
  const [filters, setFilters] = React.useState<BacklogFilters>({ search: '', productId: 'all', type: 'all', assigneeId: 'all' })
  const [draggingItemId, setDraggingItemId] = React.useState<string | null>(null)
  const [pendingRemoteChange, setPendingRemoteChange] = React.useState(false)
  const [createDefaults, setCreateDefaults] = React.useState<{ columnId?: string | null; parentId?: string | null } | null>(null)
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)
  const backlog = useBacklog({
    realtimePaused: Boolean(draggingItemId || selectedItemId),
    onRemoteChange: () => setPendingRemoteChange(true),
  })

  const filteredItems = React.useMemo(
    () => backlog.items.filter((item) => itemMatchesFilters(item, filters, backlog.teamMembers)),
    [backlog.items, backlog.teamMembers, filters],
  )
  const topLevelItems = filteredItems.filter((item) => !item.parent_item_id)
  const selectedItem = backlog.items.find((item) => item.id === selectedItemId) || null
  const parentItems = backlog.items.filter((item) => !item.parent_item_id)

  React.useEffect(() => {
    return useNotificationStore.subscribe(
      (state) => state.backlogFiltersCommand,
      (command) => {
        const payload = command.payload
        if (!payload) return
        const resolvedProduct = payload.product
          ? payload.product === 'all'
            ? 'all'
            : backlog.products.find((product) => product.id === payload.product || product.name.toLowerCase() === payload.product?.toLowerCase())?.id || payload.product
          : undefined
        const resolvedAssignee = payload.assignee
          ? payload.assignee === 'all' || payload.assignee === 'unassigned'
            ? payload.assignee
            : backlog.teamMembers.find((member) => member.id === payload.assignee || member.display_name.toLowerCase() === payload.assignee?.toLowerCase() || member.email.toLowerCase() === payload.assignee?.toLowerCase())?.id || payload.assignee
          : undefined
        setFilters((prev) => ({
          search: payload.clear ? '' : payload.search ?? prev.search,
          productId: payload.clear ? 'all' : resolvedProduct ?? prev.productId,
          type: payload.clear ? 'all' : payload.type ?? prev.type,
          assigneeId: payload.clear ? 'all' : resolvedAssignee ?? prev.assigneeId,
        }))
      },
    )
  }, [backlog.products, backlog.teamMembers])

  React.useEffect(() => {
    if (selectedItemId || !backlog.items.length) return
    const itemParam = new URLSearchParams(window.location.search).get('item')
    if (!itemParam) return
    const matchedItem = backlog.items.find((item) => item.id === itemParam || item.display_id.toLowerCase() === itemParam.toLowerCase())
    if (matchedItem) setSelectedItemId(matchedItem.id)
  }, [backlog.items, selectedItemId])

  const setMode = (mode: ViewMode) => {
    setViewMode(mode)
    sessionStorage.setItem('backlog-view-mode', mode)
  }

  const moveItemTo = async (itemId: string, columnId: string, beforeItemId?: string | null) => {
    const sortOrder = calculateInsertSortOrder(backlog.items.filter((item) => item.id !== itemId), columnId, beforeItemId)
    await backlog.moveItem(itemId, columnId, sortOrder)
    setDraggingItemId(null)
  }

  if (backlog.loading) return <PageLoader />

  return (
    <>
      <SecondaryAppBar
        description=""
        stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{filteredItems.length}</span> active backlog items</>}
        search={filters.search}
        onSearchChange={(search) => setFilters((prev) => ({ ...prev, search }))}
        searchPlaceholder="Search backlog..."
        actionButton={
          <button onClick={() => setCreateDefaults({})} className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap">
            <Plus size={14} />
            New Item
          </button>
        }
      />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase tracking-tight">Backlog</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Plan product work, link bugs, and move cards through your team workflow.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0.5">
              <button onClick={() => setMode('kanban')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${viewMode === 'kanban' ? 'bg-blue-500 text-white dark:text-mushi-bg' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800'}`}>
                <Columns3 size={13} />
                Board
              </button>
              <button onClick={() => setMode('grouped')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${viewMode === 'grouped' ? 'bg-blue-500 text-white dark:text-mushi-bg' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800'}`}>
                <GitBranch size={13} />
                Grouped
              </button>
            </div>
            <BacklogFiltersBar filters={filters} onChange={setFilters} products={backlog.products} members={backlog.teamMembers} />
          </div>
        </div>

        {pendingRemoteChange && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <span>Backlog changed while you were working.</span>
            <button onClick={() => { setPendingRemoteChange(false); void backlog.refreshBacklog() }} className="font-bold underline cursor-pointer">Refresh</button>
          </div>
        )}

        {viewMode === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {backlog.columns.map((column) => {
              const columnItems = filteredItems.filter((item) => item.column_id === column.id)
              const childItems = columnItems.filter((item) => item.parent_item_id)
              const childParentIds = new Set(childItems.map((item) => item.parent_item_id))
              const standaloneItems = columnItems.filter((item) => !item.parent_item_id && !childParentIds.has(item.id))
              return (
                <section
                  key={column.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const itemId = event.dataTransfer.getData('text/plain') || draggingItemId
                    if (itemId) void moveItemTo(itemId, column.id)
                  }}
                  className="min-h-[480px] w-80 shrink-0 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-100/70 dark:bg-gray-950/70"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-gray-800 px-3 py-3">
                    <h2 className="text-sm font-extrabold text-slate-800 dark:text-gray-100">{column.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{columnItems.length}</span>
                      <button onClick={() => setCreateDefaults({ columnId: column.id })} className="text-slate-400 hover:text-blue-500 dark:hover:text-mushi-primary cursor-pointer" title={`Add to ${column.name}`}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </header>
                  <div className="space-y-3 p-3">
                    {standaloneItems.map((item) => (
                      <BacklogCard
                        key={item.id}
                        item={item}
                        members={backlog.teamMembers}
                        onOpen={(openedItem) => setSelectedItemId(openedItem.id)}
                        onDragStart={setDraggingItemId}
                        onDragEnd={() => setDraggingItemId(null)}
                        onDropBefore={(beforeItemId) => { if (draggingItemId) void moveItemTo(draggingItemId, column.id, beforeItemId) }}
                      />
                    ))}
                    {Array.from(childParentIds).map((parentId) => {
                      const parent = backlog.items.find((item) => item.id === parentId)
                      const children = childItems.filter((item) => item.parent_item_id === parentId)
                      return (
                        <div key={parentId || 'unknown'} className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 p-2">
                          <div className="mb-2 flex items-center justify-between gap-2 px-1">
                            <button onClick={() => parent && setSelectedItemId(parent.id)} className="truncate text-left text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-mushi-primary cursor-pointer">
                              {parent ? `${parent.display_id} ${parent.title}` : 'Parent item'}
                            </button>
                            <button onClick={() => setCreateDefaults({ columnId: column.id, parentId })} className="text-slate-400 hover:text-blue-500 dark:hover:text-mushi-primary cursor-pointer" title="Add child task">
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {children.map((child) => (
                              <BacklogCard
                                key={child.id}
                                item={child}
                                members={backlog.teamMembers}
                                onOpen={(openedItem) => setSelectedItemId(openedItem.id)}
                                onDragStart={setDraggingItemId}
                                onDragEnd={() => setDraggingItemId(null)}
                                onDropBefore={(beforeItemId) => { if (draggingItemId) void moveItemTo(draggingItemId, column.id, beforeItemId) }}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {columnItems.length === 0 && (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-gray-700 text-xs text-slate-400 dark:text-gray-500">
                        Drop items here
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {topLevelItems.map((item) => {
              const children = filteredItems.filter((child) => child.parent_item_id === item.id)
              return (
                <section key={item.id} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button onClick={() => setSelectedItemId(item.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                      <span className="text-xs font-bold text-slate-400">{item.display_id}</span>
                      <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-gray-100">{item.title}</h2>
                    </button>
                    <button onClick={() => setCreateDefaults({ parentId: item.id })} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:border-mushi-primary dark:text-mushi-primary dark:hover:bg-mushi-primary/10 cursor-pointer">
                      <Plus size={13} />
                      Child task
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {children.length === 0 && <p className="text-sm text-slate-400 dark:text-gray-500">No child tasks yet.</p>}
                    {children.map((child) => (
                      <button key={child.id} onClick={() => setSelectedItemId(child.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-left hover:border-blue-300 dark:hover:border-mushi-primary/50 cursor-pointer">
                        <span className="min-w-0 text-sm text-slate-700 dark:text-gray-300">
                          <span className="mr-2 text-xs font-bold text-slate-400">{child.display_id}</span>
                          {child.title}
                        </span>
                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[child.priority]}`}>{PRIORITY_LABELS[child.priority]}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {createDefaults && (
        <NewBacklogItemModal
          columns={backlog.columns}
          products={backlog.products}
          milestones={backlog.milestones}
          members={backlog.teamMembers}
          parentItems={parentItems}
          defaultColumnId={createDefaults.columnId}
          defaultParentId={createDefaults.parentId}
          onClose={() => setCreateDefaults(null)}
          onCreate={async (input) => {
            await backlog.createItem(input)
          }}
        />
      )}

      {selectedItem && (
        <BacklogItemDetailModal
          item={selectedItem}
          columns={backlog.columns}
          products={backlog.products}
          milestones={backlog.milestones}
          members={backlog.teamMembers}
          childItems={backlog.items.filter((item) => item.parent_item_id === selectedItem.id)}
          canArchive={isTeamAdmin}
          onClose={() => setSelectedItemId(null)}
          onUpdate={async (updates) => { await backlog.updateItem(selectedItem.id, updates) }}
          onArchive={async () => { await backlog.archiveItem(selectedItem.id); setSelectedItemId(null) }}
          onComment={async (text) => { await backlog.addComment(selectedItem.id, text) }}
          onUpload={async (files) => { await backlog.uploadAttachments(selectedItem.id, files) }}
          onDeleteAttachment={async (attachmentId) => {
            const attachment = selectedItem.attachments.find((itemAttachment) => itemAttachment.id === attachmentId)
            if (attachment) await backlog.deleteAttachment(attachment)
          }}
          onMoveParentDone={async () => {
            const doneColumn = backlog.columns.find((column) => column.is_done)
            if (doneColumn) await backlog.updateItem(selectedItem.id, { column_id: doneColumn.id })
          }}
        />
      )}
    </>
  )
}
