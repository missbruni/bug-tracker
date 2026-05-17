import type { CSSProperties } from 'react'

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
	return (
		<div
			className={`animate-pulse rounded-lg bg-slate-200 dark:bg-gray-800 ${className}`}
			style={style}
		/>
	);
}

export function BugCardSkeleton({ borderColor = "var(--color-blue-400)" }: { borderColor?: string }) {
	return (
		<div
			className="mb-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900"
			style={{ borderLeft: `4px solid ${borderColor}` }}
		>
			<div className="flex items-center">
				{/* Check circle */}
				<div className="shrink-0 pl-4 pr-1 py-3">
					<Bone className="w-[18px] h-[18px] rounded-full" />
				</div>
				{/* Chevron + ID + title */}
				<div className="flex flex-1 items-center gap-2 sm:gap-3 px-2 py-3 min-w-0">
					<Bone className="w-4 h-4 rounded shrink-0" />
					<Bone className="h-3.5 w-12 shrink-0" />
					<div className="flex-1 min-w-0 space-y-1.5">
						<Bone className="h-3.5 w-3/4" />
						<Bone className="h-2.5 w-1/2" />
					</div>
					{/* Right side badges */}
					<div className="hidden md:flex items-center gap-3 shrink-0 ml-3">
						<Bone className="h-3 w-8" />
						<Bone className="h-5 w-16 rounded-full" />
					</div>
				</div>
			</div>
		</div>
	);
}

export function SessionCardSkeleton() {
	return (
		<div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
			<div className="flex items-center justify-between">
				<div className="space-y-2 flex-1">
					<Bone className="h-4 w-1/2" />
					<Bone className="h-3 w-1/3" />
				</div>
				<Bone className="h-6 w-16 rounded-full" />
			</div>
			<div className="flex gap-2">
				<Bone className="h-3 w-24" />
				<Bone className="h-3 w-20" />
			</div>
		</div>
	);
}

export function TesterCardSkeleton() {
	return (
		<div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
			<div className="flex items-center gap-3">
				<Bone className="w-8 h-8 rounded-full" />
				<div className="flex-1 space-y-2">
					<Bone className="h-4 w-1/3" />
					<Bone className="h-3 w-1/4" />
				</div>
				<Bone className="h-6 w-16 rounded-full" />
			</div>
		</div>
	);
}

export function TeamCardSkeleton() {
	return (
		<div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
			<div className="flex items-center justify-between">
				<Bone className="h-5 w-1/3" />
				<Bone className="h-6 w-16 rounded-full" />
			</div>
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
				{[1, 2, 3, 4].map((i) => (
					<Bone key={i} className="h-12 rounded-lg" />
				))}
			</div>
		</div>
	);
}

function ScenarioCardSkeleton() {
	return (
		<div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
			<div className="flex items-center gap-3">
				<Bone className="w-4 h-4 rounded shrink-0" />
				<Bone className="w-8 h-8 rounded-full shrink-0" />
				<div className="flex-1 min-w-0 space-y-1.5">
					<Bone className="h-3.5 w-3/4" />
					<Bone className="h-2.5 w-1/3" />
				</div>
				<Bone className="h-5 w-20 rounded-full" />
			</div>
		</div>
	);
}

export function SessionSetupSkeleton() {
	return (
		<div>
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<Bone className="h-6 w-48" />
						<Bone className="h-6 w-20 rounded-full" />
					</div>
					<Bone className="h-3.5 w-64" />
				</div>
				<Bone className="h-9 w-24 rounded-lg" />
			</div>

			{/* Grid: Scenarios + Tester Pool */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left: Scenarios */}
				<div className="lg:col-span-2">
					<div className="flex items-center justify-between mb-3">
						<Bone className="h-4 w-20" />
						<Bone className="h-7 w-16 rounded-md" />
					</div>
					<div className="space-y-1.5">
						{Array.from({ length: 4 }).map((_, i) => (
							<ScenarioCardSkeleton key={i} />
						))}
					</div>
				</div>

				{/* Right: Tester Pool */}
				<div>
					<div className="flex items-center justify-between mb-3">
						<Bone className="h-4 w-24" />
						<div className="flex gap-1.5">
							<Bone className="h-7 w-20 rounded-md" />
							<Bone className="h-7 w-16 rounded-md" />
						</div>
					</div>
					<div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
						<Bone className="h-3 w-48 mb-3" />
						<div className="flex flex-wrap gap-1.5">
							{Array.from({ length: 6 }).map((_, i) => (
								<Bone key={i} className="h-7 w-20 rounded-full" />
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function BugListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<div>
			{Array.from({ length: count }).map((_, i) => (
				<BugCardSkeleton key={i} />
			))}
		</div>
	);
}

export function SessionListSkeleton({ count = 4 }: { count?: number }) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, i) => (
				<SessionCardSkeleton key={i} />
			))}
		</div>
	);
}

export function TesterListSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="space-y-2">
			{Array.from({ length: count }).map((_, i) => (
				<TesterCardSkeleton key={i} />
			))}
		</div>
	);
}

export function TeamListSkeleton({ count = 2 }: { count?: number }) {
	return (
		<div className="space-y-4">
			{Array.from({ length: count }).map((_, i) => (
				<TeamCardSkeleton key={i} />
			))}
		</div>
	);
}
