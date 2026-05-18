import { X, Check } from 'lucide-react'

interface ScenarioFormProps {
	letter: string
	title: string
	description: string
	device: string
	onLetterChange: (v: string) => void
	onTitleChange: (v: string) => void
	onDescriptionChange: (v: string) => void
	onDeviceChange: (v: string) => void
	onSave: () => void
	onCancel: () => void
	saveDisabled?: boolean
	saving?: boolean
	mode: 'add' | 'edit'
}

export default function ScenarioForm({
	letter,
	title,
	description,
	device,
	onLetterChange,
	onTitleChange,
	onDescriptionChange,
	onDeviceChange,
	onSave,
	onCancel,
	saveDisabled,
	saving,
	mode,
}: ScenarioFormProps) {
	return (
		<div className={`rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-900 p-4 ${mode === 'add' ? 'mb-3' : ''}`}>
			<div className="grid grid-cols-[60px_1fr_1fr] gap-2 mb-2">
				<input
					value={letter}
					onChange={event => onLetterChange(event.target.value)}
					placeholder="Letter"
					maxLength={2}
					className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-center font-bold text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500 uppercase"
				/>
				<input
					value={title}
					onChange={event => onTitleChange(event.target.value)}
					placeholder="Scenario title *"
					className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500"
				/>
				<input
					value={device}
					onChange={event => onDeviceChange(event.target.value)}
					placeholder="Device requirement (optional)"
					className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-500"
				/>
			</div>
			<textarea
				value={description}
				onChange={event => onDescriptionChange(event.target.value)}
				placeholder="Step-by-step instructions"
				rows={4}
				className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none resize-y mb-2 focus:border-blue-500"
			/>
			<div className="flex gap-2 justify-end">
				<button
					onClick={onCancel}
					disabled={saving}
					className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-default cursor-pointer"
				>
					{mode === 'edit' ? <X size={14} /> : 'Cancel'}
				</button>
				<button
					onClick={onSave}
					disabled={saveDisabled || saving}
					className={`rounded-md px-${mode === 'edit' ? '3' : '4'} py-1.5 text-xs font-semibold text-white ${
						mode === 'edit'
							? 'bg-green-500 hover:bg-green-600'
							: 'bg-blue-500 dark:text-mushi-bg hover:bg-blue-600'
					} disabled:bg-slate-400 cursor-pointer disabled:cursor-default`}
				>
					{mode === 'edit' ? <Check size={14} /> : saving ? 'Adding...' : 'Add'}
				</button>
			</div>
		</div>
	)
}
