import React from 'react'
import { CheckCircle, Trash2, Rocket, X, CheckSquare, Square } from 'lucide-react'
import type { BulkProgress } from '../hooks/useBulkActions'

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  progress: BulkProgress | null
  allSelected: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onMarkReviewed: () => void
  onDelete: () => void
  onPublish: () => void
  onExit: () => void
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  progress,
  allSelected,
  onSelectAll,
  onDeselectAll,
  onMarkReviewed,
  onDelete,
  onPublish,
  onExit,
}: BulkActionBarProps) {
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const hasSelection = selectedCount > 0
  const isProcessing = progress !== null

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setConfirmDelete(false)
    onDelete()
  }

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-950/30">
      <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center gap-2 px-4 sm:px-7 py-2.5">
        {/* Select toggle */}
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        {/* Count */}
        <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">
          {selectedCount} of {totalCount} selected
        </span>

        {/* Progress indicator */}
        {isProcessing && (
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {progress.label}... {progress.completed}/{progress.total}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={onMarkReviewed}
          disabled={!hasSelection || isProcessing}
          className="flex items-center gap-1.5 rounded-md border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/40 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle size={12} />
          Mark Reviewed
        </button>
        <button
          onClick={onPublish}
          disabled={!hasSelection || isProcessing}
          className="flex items-center gap-1.5 rounded-md border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/40 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Rocket size={12} />
          Publish
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">Confirm delete?</span>
            <button
              onClick={handleDelete}
              disabled={isProcessing}
              className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-40"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            disabled={!hasSelection || isProcessing}
            className="flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            Delete
          </button>
        )}

        {/* Exit selection mode */}
        <button
          onClick={onExit}
          disabled={isProcessing}
          className="flex items-center gap-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40"
          title="Exit selection mode"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
