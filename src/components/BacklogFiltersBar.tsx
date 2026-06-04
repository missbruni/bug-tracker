import React from 'react'
import { Filter, Search } from 'lucide-react'
import { ITEM_TYPES, TYPE_LABELS } from '../domains/backlog/display'
import type { BacklogFilters } from '../domains/backlog/filters'
import type { BacklogProduct, BacklogTeamMember } from '../domains/backlog/model'

export default function BacklogFiltersBar({
  filters,
  onChange,
  products,
  members,
}: {
  filters: BacklogFilters
  onChange: React.Dispatch<React.SetStateAction<BacklogFilters>>
  products: BacklogProduct[]
  members: BacklogTeamMember[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5">
      <Filter size={13} className="text-slate-400" />
      <select value={filters.productId} onChange={(event) => onChange((prev) => ({ ...prev, productId: event.target.value }))} className="rounded-md border-0 bg-transparent px-1 text-xs font-semibold text-slate-600 outline-none dark:text-gray-300">
        <option value="all">All products</option>
        {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
      <select value={filters.type} onChange={(event) => onChange((prev) => ({ ...prev, type: event.target.value }))} className="rounded-md border-0 bg-transparent px-1 text-xs font-semibold text-slate-600 outline-none dark:text-gray-300">
        <option value="all">All types</option>
        {ITEM_TYPES.map((itemType) => <option key={itemType} value={itemType}>{TYPE_LABELS[itemType]}</option>)}
      </select>
      <select value={filters.assigneeId} onChange={(event) => onChange((prev) => ({ ...prev, assigneeId: event.target.value }))} className="rounded-md border-0 bg-transparent px-1 text-xs font-semibold text-slate-600 outline-none dark:text-gray-300">
        <option value="all">All assignees</option>
        <option value="unassigned">Unassigned</option>
        {members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
      </select>
      <Search size={13} className="hidden text-slate-400 sm:block" />
    </div>
  )
}
