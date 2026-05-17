import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Check, X, Users, Bug, CalendarDays, Package, Plus, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import type { TeamRecord } from '../lib/teamScope'
import InlineDeleteConfirm from './InlineDeleteConfirm'

export interface TeamStats {
  testers: number
  activeTesters: number
  sessions: number
  activeBugs: number
}

export interface Product {
  id: string
  team_id: string
  name: string
  slug: string
  description?: string | null
  link?: string | null
}

interface TeamCardProps {
  team: TeamRecord
  isActive: boolean
  isDefault: boolean
  stats: TeamStats | undefined
  products: Product[]
  onSelect: () => void
  onStartEdit: () => void
  onDelete: () => void
  onAddProduct: (product: { name: string; description?: string; link?: string }) => Promise<void>
  onUpdateProduct: (productId: string, product: { name: string; description?: string; link?: string }) => Promise<void>
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

export default function TeamCard({
  team,
  isActive,
  isDefault,
  stats,
  products,
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
  const [addingProduct, setAddingProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductDesc, setNewProductDesc] = useState('')
  const [newProductLink, setNewProductLink] = useState('')
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editProductDesc, setEditProductDesc] = useState('')
  const [editProductLink, setEditProductLink] = useState('')
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [productsExpanded, setProductsExpanded] = useState(true)

  const handleAddProduct = async () => {
    if (!newProductName.trim() || creatingProduct) return
    setCreatingProduct(true)
    await onAddProduct({
      name: newProductName.trim(),
      description: newProductDesc.trim() || undefined,
      link: newProductLink.trim() || undefined,
    })
    setNewProductName('')
    setNewProductDesc('')
    setNewProductLink('')
    setAddingProduct(false)
    setCreatingProduct(false)
  }

  const startEditProduct = (product: Product) => {
    setEditingProductId(product.id)
    setEditProductName(product.name)
    setEditProductDesc(product.description || '')
    setEditProductLink(product.link || '')
  }

  const saveEditProduct = async () => {
    if (!editingProductId || !editProductName.trim()) return
    await onUpdateProduct(editingProductId, {
      name: editProductName.trim(),
      description: editProductDesc.trim() || undefined,
      link: editProductLink.trim() || undefined,
    })
    setEditingProductId(null)
  }

  const confirmDeleteProduct = (productId: string) => {
    setDeletingProductId(productId)
  }

  return (
    <div
      className={`rounded-xl border px-5 py-4 transition-colors ${
        isActive
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm'
      } ${deleting ? 'opacity-50' : ''}`}
    >
      {isEditing ? (
        <div>
          <input
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
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
            <button onClick={onStartEdit}
              className="text-slate-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer p-0.5">
              <Pencil size={13} />
            </button>
            {isActive && (
              <span className="badge badge-blue">
                Active
              </span>
            )}
            {!isDefault && (
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
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
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            >
              <div className="rounded-lg bg-violet-100 dark:bg-violet-900/30 p-2">
                <CalendarDays size={16} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {stats?.sessions ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-violet-600 dark:group-hover:text-violet-400">Sessions</span>
              </div>
            </Link>
            <Link
              to="/"
              onClick={() => onSelect()}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <div className={`rounded-lg p-2 ${(stats?.activeBugs ?? 0) > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-gray-700'}`}>
                <Bug size={16} className={(stats?.activeBugs ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-gray-500'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {stats?.activeBugs ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-red-600 dark:group-hover:text-red-400">Active bugs</span>
              </div>
            </Link>
            <button
              onClick={() => setProductsExpanded(!productsExpanded)}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-red-400 dark:hover:border-mushi-threat/50 hover:bg-red-50 dark:hover:bg-mushi-threat/10 transition-colors cursor-pointer"
            >
              <div className="rounded-lg bg-red-100 dark:bg-mushi-threat/15 p-2">
                <Package size={16} className="text-red-500 dark:text-mushi-threat" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-gray-100">
                  {products.length}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-mushi-threat">Products</span>
              </div>
              <div className="ml-auto">
                {productsExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>
            </button>
          </div>

          {/* Products section (collapsible) */}
          {productsExpanded && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Package size={14} className="text-slate-400 dark:text-gray-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Products</span>
              <button
                onClick={() => { setAddingProduct(true); setNewProductName(''); setNewProductDesc(''); setNewProductLink('') }}
                className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                title="Add product"
              >
                <Plus size={12} /> Add
              </button>
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
                      onChange={(e) => setEditProductName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditProduct(); if (e.key === 'Escape') setEditingProductId(null) }}
                      placeholder="Product name *"
                      className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                    />
                    <input
                      value={editProductDesc}
                      onChange={(e) => setEditProductDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                    />
                    <input
                      value={editProductLink}
                      onChange={(e) => setEditProductLink(e.target.value)}
                      placeholder="URL (optional)"
                      className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                    />
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
                    className="group rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 px-3.5 py-2.5 hover:border-red-400 dark:hover:border-mushi-threat/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-red-100 dark:bg-mushi-threat/15 p-1.5 mt-0.5">
                        <Package size={14} className="text-red-500 dark:text-mushi-threat" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{product.name}</p>
                          {product.link && (
                            <a
                              href={product.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title={product.link}
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                        )}
                      </div>
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
                  onChange={(e) => setNewProductName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newProductName.trim()) handleAddProduct(); if (e.key === 'Escape') setAddingProduct(false) }}
                  placeholder="Product name *"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                />
                <input
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                />
                <input
                  value={newProductLink}
                  onChange={(e) => setNewProductLink(e.target.value)}
                  placeholder="URL (optional)"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400"
                />
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
          )}
        </div>
      )}
    </div>
  )
}
