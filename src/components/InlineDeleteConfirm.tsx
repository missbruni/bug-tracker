interface InlineDeleteConfirmProps {
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function InlineDeleteConfirm({ isDeleting, onConfirm, onCancel }: InlineDeleteConfirmProps) {
  return (
    <span
      className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-mushi-surface border border-slate-200 dark:border-gray-700 px-2.5 py-1 font-heading"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-red-500 dark:text-mushi-threat">Delete?</span>
      {isDeleting ? (
        <span className="text-[10px] text-slate-400 dark:text-gray-500">Deleting...</span>
      ) : (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="rounded-md bg-red-500 dark:bg-mushi-threat px-2 py-0.5 text-[10px] font-bold uppercase text-white dark:text-gray-900 cursor-pointer hover:bg-red-600 dark:hover:bg-mushi-threat/80 transition-colors"
            title="Confirm delete"
          >
            Yes
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="rounded-md border border-gray-600 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400 dark:text-gray-400 cursor-pointer hover:bg-gray-700/30 transition-colors"
            title="Cancel delete"
          >
            No
          </button>
        </>
      )}
    </span>
  )
}
