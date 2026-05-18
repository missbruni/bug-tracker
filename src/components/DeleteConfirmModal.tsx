import React from 'react'

interface DeleteConfirmModalProps {
  title: string
  description: string
  confirmToken: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  confirmButtonText?: string
  error?: string | null
}

export default function DeleteConfirmModal({
  title,
  description,
  confirmToken,
  onCancel,
  onConfirm,
  confirmButtonText = 'Delete permanently',
  error,
}: DeleteConfirmModalProps) {
  const [input, setInput] = React.useState('')

  React.useEffect(() => {
    setInput('')
  }, [confirmToken])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-gray-400 mb-3 leading-relaxed">{description}</p>
        {error && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}
        <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
          Type <span className="font-mono font-bold text-red-500">{confirmToken}</span> to confirm:
        </p>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={confirmToken}
          autoFocus
          className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-red-400 dark:focus:border-red-500 mb-4 font-mono"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={input !== confirmToken}
            className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-gray-700 disabled:text-slate-500 dark:disabled:text-gray-500 cursor-pointer disabled:cursor-default transition-colors"
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}
