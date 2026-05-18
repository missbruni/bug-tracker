import { ChevronUp, ChevronDown, GripVertical, Pencil, Trash2, Lock } from 'lucide-react'
import type { Scenario, Tester } from '../types'

interface ScenarioCardProps {
	scenario: Scenario
	index: number
	totalCount: number
	assigned?: Tester | null
	isSelected: boolean
	isExpanded: boolean
	isCompleted: boolean
	isDeviceLocked: boolean
	isDragOver?: boolean
	draggable?: boolean
	onClick: () => void
	onMoveUp: () => void
	onMoveDown: () => void
	onEdit: () => void
	onDelete: () => void
	onDrop?: (event: React.DragEvent) => void
	onDragOver?: (event: React.DragEvent) => void
	onDragLeave?: (event: React.DragEvent) => void
	onDragStart?: (event: React.DragEvent) => void
}

export default function ScenarioCard({
	scenario,
	index,
	totalCount,
	assigned,
	isSelected,
	isExpanded,
	isCompleted,
	isDeviceLocked,
	isDragOver,
	draggable,
	onClick,
	onMoveUp,
	onMoveDown,
	onEdit,
	onDelete,
	onDrop,
	onDragOver,
	onDragLeave,
	onDragStart,
}: ScenarioCardProps) {
	return (
		<div
			onClick={onClick}
			onDrop={onDrop}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			draggable={draggable}
			onDragStart={onDragStart}
			className={`rounded-lg border bg-white dark:bg-gray-900 p-3 cursor-pointer transition-all select-none ${
				isDragOver
					? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-50 dark:bg-blue-900/20'
					: isSelected
					? 'border-blue-500 ring-1 ring-blue-500/30'
					: isExpanded
					? 'border-blue-500/50 ring-1 ring-blue-500/20'
					: 'border-slate-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
			}`}
		>
			<div className="flex items-center gap-3">
				{isCompleted
					? <ChevronDown size={14} className={`text-slate-400 dark:text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
					: <GripVertical size={14} className="text-slate-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing" />
				}
				<span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white dark:text-mushi-bg text-xs font-bold shrink-0">
					{scenario.letter}
				</span>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{scenario.title}</p>
					<div className="flex items-center gap-2 mt-0.5">
						{scenario.device_requirement && (
							<span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
								{isDeviceLocked && <Lock size={10} />}
								{scenario.device_requirement}
							</span>
						)}
					</div>
				</div>
				{assigned ? (
					<span className="badge badge-blue">
						{assigned.name}
					</span>
				) : (
					<span className="inline-flex items-center rounded-full border border-dashed border-slate-300 dark:border-gray-600 px-2.5 py-0.5 text-[11px] text-slate-400 dark:text-gray-500">
						Unassigned
					</span>
				)}
				{!isCompleted && (
					<div className="flex items-center gap-0.5 shrink-0" onClick={event => event.stopPropagation()}>
						<button onClick={onMoveUp} disabled={index === 0}
							className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
							<ChevronUp size={14} />
						</button>
						<button onClick={onMoveDown} disabled={index === totalCount - 1}
							className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
							<ChevronDown size={14} />
						</button>
						<button onClick={onEdit}
							className="p-1 text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer">
							<Pencil size={14} />
						</button>
						<button onClick={onDelete}
							className="p-1 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer">
							<Trash2 size={14} />
						</button>
					</div>
				)}
			</div>
			<div className={`collapse-grid ${isExpanded && scenario.description ? 'open' : ''}`}>
			<div>
				<div className="mt-3 pt-3 pb-1 px-1 border-t border-slate-100 dark:border-gray-800 space-y-1.5">
					{scenario.description?.split('\n').filter(l => l.trim()).map((line, i) => {
						const trimmed = line.trim()
						const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
						const isCheck = trimmed.startsWith('✓') || trimmed.startsWith('✔')
						if (numberedMatch) {
							return (
								<div key={i} className="flex gap-2.5 items-start">
									<span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">{numberedMatch[1]}</span>
									<span className="text-[13px] text-slate-700 dark:text-gray-300 leading-relaxed">{numberedMatch[2]}</span>
								</div>
							)
						}
						if (isCheck) {
							return (
								<div key={i} className="flex gap-2 items-center mt-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-3 py-2">
									<span className="text-green-500 shrink-0 leading-none">✓</span>
									<span className="text-[13px] font-medium text-green-700 dark:text-green-400">{trimmed.replace(/^[✓✔]\s*/, '')}</span>
								</div>
							)
						}
						return <p key={i} className="text-[13px] text-slate-600 dark:text-gray-400 leading-relaxed">{trimmed}</p>
					})}
				</div>
			</div>
			</div>
		</div>
	)
}
