import { ChevronDown } from 'lucide-react'
import { SESSION_STATUS_STYLES } from '../constants'
import type { SessionStatus } from '../hooks/useBugs'

interface StatusMenuProps {
	currentStatus: SessionStatus
	open: boolean
	onToggle: () => void
	onSelect: (status: SessionStatus) => void
	onClose: () => void
	disabled?: boolean
}

export default function StatusMenu({ currentStatus, open, onToggle, onSelect, onClose, disabled }: StatusMenuProps) {
	const st = SESSION_STATUS_STYLES[currentStatus]

	return (
		<div className="relative">
			<button
				onClick={(event) => { event.preventDefault(); if (!disabled) onToggle() }}
				disabled={disabled}
				className={`badge ${st.bg} ${disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-80'} transition-opacity`}
			>
				{currentStatus}
				{!disabled && <ChevronDown size={10} />}
			</button>
			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={(event) => { event.preventDefault(); onClose() }} />
					<div className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 min-w-[120px]">
						{(['draft', 'active', 'completed'] as const).map(s => {
							const sty = SESSION_STATUS_STYLES[s]
							return (
								<button
									key={s}
									onClick={(event) => { event.preventDefault(); onSelect(s) }}
									className={`w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
										currentStatus === s
											? sty.bg
											: 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800'
									}`}
								>
									{s}
								</button>
							)
						})}
					</div>
				</>
			)}
		</div>
	)
}
