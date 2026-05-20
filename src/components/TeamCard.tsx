import React from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Check, X, Users, UserCog, Bug, CalendarDays, Package, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import type { TeamRecord } from '../lib/teamScope'
import InlineDeleteConfirm from './InlineDeleteConfirm'

export interface TeamStats {
  testers: number
  activeTesters: number
  sessions: number
  activeBugs: number
  members: number
}

export interface ProductLink {
  label: string
  url: string
}

export interface Product {
  id: string
  team_id: string
  name: string
  slug: string
  description?: string | null
  link?: string | null
  links?: ProductLink[] | null
}

interface TeamCardProps {
  team: TeamRecord
  isActive: boolean
  isDefault: boolean
  stats: TeamStats | undefined
  products: Product[]
  canEdit?: boolean
  onManageMembers?: () => void
  onSelect: () => void
  onStartEdit: () => void
  onDelete: () => void
  onAddProduct: (product: { name: string; description?: string; links?: ProductLink[] }) => Promise<void>
  onUpdateProduct: (productId: string, product: { name: string; description?: string; links?: ProductLink[] }) => Promise<void>
  onDeleteProduct: (productId: string) => void
  isEditing: boolean
  editName: string
  onEditNameChange: (name: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  pendingDelete: boolean
  deleting: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

export function parseProductLink(raw: unknown): ProductLink {
  if (raw && typeof raw === 'object' && 'url' in raw) {
    const obj = raw as Record<string, unknown>
    return { label: String(obj.label || ''), url: String(obj.url || '') }
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string') {
        return { label: String(parsed.label || ''), url: parsed.url }
      }
    } catch { /* not JSON, treat as plain URL */ }
    return { label: '', url: raw }
  }
  return { label: '', url: '' }
}

export default function TeamCard({
  team,
  isActive,
  isDefault,
  stats,
  products,
  canEdit = true,
  onManageMembers,
  onSelect,
  onStartEdit,
  onDelete,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  isEditing,
  editName,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  pendingDelete,
  deleting,
  onConfirmDelete,
  onCancelDelete,
}: TeamCardProps) {
  const [addingProduct, setAddingProduct] = React.useState(false)
  const [newProductName, setNewProductName] = React.useState('')
  const [newProductDesc, setNewProductDesc] = React.useState('')
  const [newProductLinks, setNewProductLinks] = React.useState<ProductLink[]>([{ label: '', url: '' }])
  const [creatingProduct, setCreatingProduct] = React.useState(false)
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null)
  const [editProductName, setEditProductName] = React.useState('')
  const [editProductDesc, setEditProductDesc] = React.useState('')
  const [editProductLinks, setEditProductLinks] = React.useState<ProductLink[]>([{ label: '', url: '' }])
  const [deletingProductId, setDeletingProductId] = React.useState<string | null>(null)
  const [productsExpanded, setProductsExpanded] = React.useState(true)

  const handleAddProduct = async () => {
    if (!newProductName.trim() || creatingProduct) return
    setCreatingProduct(true)
    const trimmedLinks = newProductLinks.filter(l => l.url.trim()).map(l => ({ label: l.label.trim(), url: l.url.trim() }))
    await onAddProduct({
      name: newProductName.trim(),
      description: newProductDesc.trim() || undefined,
      links: trimmedLinks.length ? trimmedLinks : undefined,
    })
    setNewProductName('')
    setNewProductDesc('')
    setNewProductLinks([{ label: '', url: '' }])
    setAddingProduct(false)
    setCreatingProduct(false)
  }

  const startEditProduct = (product: Product) => {
    setEditingProductId(product.id)
    setEditProductName(product.name)
    setEditProductDesc(product.description || '')
    const existingLinks: ProductLink[] = product.links?.length
      ? product.links.map(l => parseProductLink(l))
      : product.link ? [{ label: '', url: product.link }] : [{ label: '', url: '' }]
    setEditProductLinks(existingLinks)
  }

  const saveEditProduct = async () => {
    if (!editingProductId || !editProductName.trim()) return
    const trimmedLinks = editProductLinks.filter(l => l.url.trim()).map(l => ({ label: l.label.trim(), url: l.url.trim() }))
    await onUpdateProduct(editingProductId, {
      name: editProductName.trim(),
      description: editProductDesc.trim() || undefined,
      links: trimmedLinks.length ? trimmedLinks : undefined,
    })
    setEditingProductId(null)
  }

  const confirmDeleteProduct = (productId: string) => {
    setDeletingProductId(productId)
  }

  return (
    <div
      className={`card rounded-xl px-5 py-4 transition-colors ${
        isActive
          ? 'border-blue-500!'
          : ''
      } ${deleting ? 'opacity-50' : ''}`}
    >
      {isEditing ? (
        <div>
          <input
            value={editName}
            onChange={(event) => onEditNameChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') onSaveEdit(); if (event.key === 'Escape') onCancelEdit() }}
            className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 mb-3"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelEdit}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 cursor-pointer">
              <X size={14} />
            </button>
            <button onClick={onSaveEdit}
              className="rounded-md bg-green-500 px-3 py-1.5 text-xs text-white font-semibold cursor-pointer hover:bg-green-600">
              <Check size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onSelect}
              className="flex-1 min-w-0 text-left cursor-pointer"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">{team.name}</h2>
            </button>
            {canEdit && (
              <button onClick={onStartEdit}
                className="text-slate-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer p-0.5">
                <Pencil size={13} />
              </button>
            )}
            {isActive && (
              <span className="badge badge-blue">
                Active
              </span>
            )}
            {canEdit && !isDefault && (
              <button
                onClick={onDelete}
                disabled={deleting}
                className="text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer p-1 disabled:opacity-60 disabled:cursor-default"
              >
                <Trash2 size={14} />
              </button>
            )}
            {pendingDelete && (
              <InlineDeleteConfirm
                isDeleting={deleting}
                onConfirm={onConfirmDelete}
                onCancel={onCancelDelete}
              />
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
            <button
              onClick={onManageMembers}
              disabled={!onManageMembers}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors cursor-pointer disabled:cursor-default"
            >
              <div className="rounded-lg bg-sky-100 dark:bg-sky-900/30 p-2">
                <UserCog size={16} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {stats?.members ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-sky-600 dark:group-hover:text-sky-400">Members</span>
              </div>
            </button>
            <Link
              to="/testers"
              onClick={() => onSelect()}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2">
                <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {stats?.testers ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Testers</span>
              </div>
            </Link>
            <Link
              to="/sessions"
              onClick={() => onSelect()}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-amber-400 dark:hover:border-mushi-warning/50 hover:bg-amber-50 dark:hover:bg-mushi-warning/10 transition-colors"
            >
              <div className="rounded-lg bg-amber-100 dark:bg-mushi-warning/15 p-2">
                <CalendarDays size={16} className="text-amber-500 dark:text-mushi-warning" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {stats?.sessions ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-amber-500 dark:group-hover:text-mushi-warning">Sessions</span>
              </div>
            </Link>
            <Link
              to="/"
              onClick={() => onSelect()}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-fuchsia-400 dark:hover:border-mushi-secondary/60 hover:bg-fuchsia-50 dark:hover:bg-mushi-secondary/10 transition-colors"
            >
              <div className={`rounded-lg p-2 ${(stats?.activeBugs ?? 0) > 0 ? 'bg-fuchsia-100 dark:bg-mushi-secondary/15' : 'bg-slate-100 dark:bg-gray-700'}`}>
                <Bug size={16} className={(stats?.activeBugs ?? 0) > 0 ? 'text-fuchsia-600 dark:text-mushi-secondary' : 'text-slate-500 dark:text-gray-500'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {stats?.activeBugs ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-fuchsia-600 dark:group-hover:text-mushi-secondary">Active bugs</span>
              </div>
            </Link>
            <button
              onClick={() => setProductsExpanded(!productsExpanded)}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-violet-400 dark:hover:border-mushi-tertiary/50 hover:bg-violet-50 dark:hover:bg-mushi-tertiary/10 transition-colors cursor-pointer"
            >
              <div className="rounded-lg bg-violet-100 dark:bg-mushi-tertiary/15 p-2">
                <Package size={16} className="text-violet-600 dark:text-mushi-tertiary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {products.length}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-violet-600 dark:group-hover:text-mushi-tertiary">Products</span>
              </div>
              <div className="ml-auto">
                {productsExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>
            </button>
          </div>

          {/* Products section (collapsible) */}
          <div className={`collapse-grid ${productsExpanded ? 'open' : ''}`}>
          <div>
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Package size={14} className="text-slate-400 dark:text-gray-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Products</span>
              {canEdit && (
                <button
                  onClick={() => { setAddingProduct(true); setNewProductName(''); setNewProductDesc(''); setNewProductLinks([{ label: '', url: '' }]) }}
                  className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  title="Add product"
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {products.length === 0 && !addingProduct && (
              <p className="text-xs text-slate-400 dark:text-gray-600 italic py-2">No products registered yet.</p>
            )}

            <div className="space-y-2">
              {products.map((product) => (
                editingProductId === product.id ? (
                  <div key={product.id} className="rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-800 p-3 space-y-2">
                    <input
                      autoFocus
                      value={editProductName}
                      onChange={(event) => setEditProductName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') saveEditProduct(); if (event.key === 'Escape') setEditingProductId(null) }}
                      placeholder="Product name *"
                      className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                    />
                    <input
                      value={editProductDesc}
                      onChange={(event) => setEditProductDesc(event.target.value)}
                      placeholder="Description (optional)"
                      className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                    />
                    <div className="space-y-1.5">
                      {editProductLinks.map((link, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            value={link.label}
                            onChange={(event) => { const next = [...editProductLinks]; next[i] = { ...next[i], label: event.target.value }; setEditProductLinks(next) }}
                            placeholder="Label"
                            className="w-28 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                          />
                          <input
                            value={link.url}
                            onChange={(event) => { const next = [...editProductLinks]; next[i] = { ...next[i], url: event.target.value }; setEditProductLinks(next) }}
                            placeholder="https://..."
                            className="flex-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                          />
                          {editProductLinks.length > 1 && (
                            <button onClick={() => setEditProductLinks(editProductLinks.filter((_, j) => j !== i))}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title="Remove link">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setEditProductLinks([...editProductLinks, { label: '', url: '' }])}
                        className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600 cursor-pointer">
                        <Plus size={10} /> Add link
                      </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingProductId(null)}
                        className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1 text-xs text-slate-600 dark:text-gray-400 cursor-pointer">
                        Cancel
                      </button>
                      <button onClick={saveEditProduct}
                        disabled={!editProductName.trim()}
                        className="rounded-md bg-blue-500 px-3 py-1 text-xs font-semibold text-white dark:text-mushi-bg cursor-pointer hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-default">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={product.id}
                    className="group rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-violet-400 dark:hover:border-mushi-tertiary/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-violet-100 dark:bg-mushi-tertiary/15 p-1.5 mt-0.5">
                        <Package size={14} className="text-violet-600 dark:text-mushi-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{product.name}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5 line-clamp-2">
                          {product.description}
                          {product.description && (product.links?.length || product.link) ? ' · ' : ''}
                          {(product.links?.length ? product.links.map(l => parseProductLink(l)) : product.link ? [{ label: '', url: product.link }] : []).map((lnk, i, _arr) => {
                            const url = lnk.url
                            const label = lnk.label || (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return 'Link' } })()
                            return (
                              <span key={i}>
                                {i > 0 && <span className="text-slate-300 dark:text-gray-600"> · </span>}
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                                  title={url}
                                >
                                  {label}
                                </a>
                              </span>
                            )
                          })}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEditProduct(product)}
                            className="p-1 text-slate-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            title="Edit product"
                          >
                            <Pencil size={12} />
                          </button>
                          {deletingProductId === product.id ? (
                            <span className="flex items-center gap-0.5">
                              <button
                                onClick={() => { onDeleteProduct(product.id); setDeletingProductId(null) }}
                                className="p-1 text-green-500 hover:text-green-600 cursor-pointer"
                                title="Confirm delete"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => setDeletingProductId(null)}
                                className="p-1 text-red-500 hover:text-red-600 cursor-pointer"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => confirmDeleteProduct(product.id)}
                              className="p-1 text-slate-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>

            {addingProduct && (
              <div className="mt-2 rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-800 p-3 space-y-2">
                <input
                  autoFocus
                  value={newProductName}
                  onChange={(event) => setNewProductName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && newProductName.trim()) handleAddProduct(); if (event.key === 'Escape') setAddingProduct(false) }}
                  placeholder="Product name *"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                />
                <input
                  value={newProductDesc}
                  onChange={(event) => setNewProductDesc(event.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                />
                <div className="space-y-1.5">
                  {newProductLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        value={link.label}
                        onChange={(event) => { const next = [...newProductLinks]; next[i] = { ...next[i], label: event.target.value }; setNewProductLinks(next) }}
                        placeholder="Label"
                        className="w-28 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                      />
                      <input
                        value={link.url}
                        onChange={(event) => { const next = [...newProductLinks]; next[i] = { ...next[i], url: event.target.value }; setNewProductLinks(next) }}
                        placeholder="https://..."
                        className="flex-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                      />
                      {newProductLinks.length > 1 && (
                        <button onClick={() => setNewProductLinks(newProductLinks.filter((_, j) => j !== i))}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title="Remove link">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setNewProductLinks([...newProductLinks, { label: '', url: '' }])}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600 cursor-pointer">
                    <Plus size={10} /> Add link
                  </button>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setAddingProduct(false)}
                    className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1 text-xs text-slate-600 dark:text-gray-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProduct}
                    disabled={!newProductName.trim() || creatingProduct}
                    className="rounded-md bg-blue-500 px-3 py-1 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default"
                  >
                    {creatingProduct ? 'Adding...' : 'Add Product'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
