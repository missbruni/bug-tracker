import type { ReactNode } from 'react'

interface ConfirmModalProps {
	title: string
	titleClassName?: string
	children: ReactNode
	confirmLabel: string
	confirmClassName?: string
	cancelLabel?: string
	onConfirm: () => void
	onCancel: () => void
	disabled?: boolean
	loading?: boolean
}

export default function ConfirmModal({
	title,
	titleClassName = 'text-sm font-bold text-slate-900 dark:text-gray-100 mb-2',
	children,
	confirmLabel,
	confirmClassName = 'rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-on-primary hover:bg-blue-600 cursor-pointer transition-colors',
	cancelLabel = 'Cancel',
	onConfirm,
	onCancel,
	disabled,
	loading,
}: ConfirmModalProps) {
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			onClick={() => { if (!loading) onCancel() }}
		>
			<div
				className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6"
				onClick={(event) => event.stopPropagation()}
			>
				<h2 className={titleClassName}>{title}</h2>
				{children}
				<div className="flex gap-2 justify-end">
					<button
						onClick={onCancel}
						disabled={loading}
						className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default cursor-pointer transition-colors"
					>
						{cancelLabel}
					</button>
					<button
						onClick={onConfirm}
						disabled={disabled || loading}
						className={`${confirmClassName} disabled:bg-slate-300 dark:disabled:bg-gray-700 disabled:text-slate-500 dark:disabled:text-gray-500 disabled:cursor-default`}
					>
						{loading ? 'Processing...' : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	)
}
