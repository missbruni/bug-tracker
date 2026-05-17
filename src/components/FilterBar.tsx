import { useState, useCallback } from "react";
import { ArrowDownUp, SlidersHorizontal, X } from "lucide-react";
import type { Bug, SessionOption } from "../types";
import type { Severity } from "../constants";

interface FilterBarProps {
	bugs: Bug[];
	activeBugs: Bug[];
	counts: Record<Severity, number>;
	severityFilter: string;
	setSeverityFilter: (value: string) => void;
	testerFilter: string;
	setTesterFilter: (value: string) => void;
	dateFilter: string;
	setDateFilter: (value: string) => void;
	sessionFilter: string;
	setSessionFilter: (value: string) => void;
	sortOrder: string;
	setSortOrder: (value: string) => void;
	testers: string[];
	sessions: SessionOption[];
}

export default function FilterBar({
	bugs,
	activeBugs,
	counts,
	severityFilter,
	setSeverityFilter,
	testerFilter,
	setTesterFilter,
	dateFilter,
	setDateFilter,
	sessionFilter,
	setSessionFilter,
	sortOrder,
	setSortOrder,
	testers,
	sessions,
}: FilterBarProps) {
	const [sheetOpen, setSheetOpen] = useState(false);
	const [closing, setClosing] = useState(false);

	const closeSheet = useCallback(() => {
		setClosing(true);
		setTimeout(() => {
			setSheetOpen(false);
			setClosing(false);
		}, 200);
	}, []);

	const selectedActiveSeverities = new Set(
		severityFilter
			.split(",")
			.map((token) => token.trim().toLowerCase())
			.filter(Boolean),
	);

	const filters = [
		{ key: "all", label: `Active (${activeBugs.length})` },
		{ key: "critical", label: `Critical (${counts.critical})` },
		{ key: "high", label: `High (${counts.high})` },
		{ key: "low", label: `Low (${counts.low})` },
		{
			key: "completed",
			label: `Completed (${bugs.filter((bug) => bug.reviewed).length})`,
		},
	];

	const activeFilterCount = [
		severityFilter !== "all" ? 1 : 0,
		testerFilter !== "all" ? 1 : 0,
		dateFilter !== "all" ? 1 : 0,
		sessionFilter !== "all" ? 1 : 0,
		sortOrder !== "default" ? 1 : 0,
	].reduce((a, b) => a + b, 0);

	const renderFilters = () => (
		<>
			{filters.map((filterOption) => {
				const isSelected =
					filterOption.key === "all" || filterOption.key === "completed"
						? severityFilter === filterOption.key
						: selectedActiveSeverities.has(filterOption.key);

				return (
					<button
						key={filterOption.key}
						onClick={() => setSeverityFilter(filterOption.key)}
						className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer text-center ${
							isSelected
								? "bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100"
								: "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
						}`}
					>
						{filterOption.label}
					</button>
				);
			})}
			<select
				value={testerFilter}
				onChange={(event) => setTesterFilter(event.target.value)}
				className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
			>
				<option value="all">All testers</option>
				{testers.map((testerName) => (
					<option key={testerName} value={testerName}>
						{testerName}
					</option>
				))}
			</select>
			<select
				value={dateFilter}
				onChange={(event) => setDateFilter(event.target.value)}
				className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
			>
				<option value="all">All dates</option>
				<option value="today">Today</option>
				<option value="yesterday">Yesterday</option>
				<option value="7d">Last 7 days</option>
				<option value="30d">Last 30 days</option>
			</select>
			{sessions.length > 0 && (
				<select
					value={sessionFilter}
					onChange={(event) => setSessionFilter(event.target.value)}
					className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
				>
					<option value="all">All sessions</option>
					<option value="none">No session</option>
					{sessions.map((session) => (
						<option key={session.id} value={session.id}>
							{session.name}
						</option>
					))}
				</select>
			)}
			<button
				onClick={() =>
					setSortOrder(
						sortOrder === "newest"
							? "oldest"
							: sortOrder === "oldest"
								? "default"
								: "newest",
					)
				}
				className={`sm:ml-auto flex items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
					sortOrder !== "default"
						? "bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100"
						: "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
				}`}
				title={
					sortOrder === "newest"
						? "Newest first"
						: sortOrder === "oldest"
							? "Oldest first"
							: "Default order"
				}
			>
				<ArrowDownUp size={12} />
				{sortOrder === "newest"
					? "Newest"
					: sortOrder === "oldest"
						? "Oldest"
						: "Sort"}
			</button>
		</>
	);

	return (
		<div className="border-b border-slate-200 dark:border-gray-800">
			{/* Desktop: inline filters */}
			<div className="hidden md:flex max-w-screen-2xl mx-auto flex-wrap items-center gap-2 px-7 py-3.5">
				{renderFilters()}
			</div>

			{/* Mobile: filter button */}
			<div className="md:hidden px-4 py-3">
				<button
					onClick={() => setSheetOpen(true)}
					className="flex items-center gap-2 rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 w-full justify-center"
				>
					<SlidersHorizontal size={14} />
					Filters
					{activeFilterCount > 0 && (
						<span className="ml-1 rounded-full bg-blue-500 text-white px-1.5 py-0.5 text-[10px] leading-none">
							{activeFilterCount}
						</span>
					)}
				</button>
			</div>

			{/* Mobile bottom sheet */}
			{sheetOpen && (
				<div className="md:hidden fixed inset-0 z-50">
					<div
						className={`absolute inset-0 transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"} bg-black/40`}
						onClick={closeSheet}
					/>
					<div
						className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl p-5 pb-8 max-h-[80vh] overflow-y-auto"
						style={{
							animation: `${closing ? "slideDown" : "slideUp"} 0.25s ease-out forwards`,
						}}
					>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-sm font-bold text-slate-900 dark:text-gray-100">
								Filters
							</h3>
							<button
								onClick={closeSheet}
								className="p-1 rounded-md text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"
							>
								<X size={18} />
							</button>
						</div>

						<div className="space-y-4">
							{/* Severity */}
							<div>
								<label className="block text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase mb-2">
									Status / Severity
								</label>
								<div className="grid grid-cols-2 gap-2">
									{filters.map((filterOption) => {
										const isSelected =
											filterOption.key === "all" ||
											filterOption.key === "completed"
												? severityFilter === filterOption.key
												: selectedActiveSeverities.has(filterOption.key);
										return (
											<button
												key={filterOption.key}
												onClick={() => setSeverityFilter(filterOption.key)}
												className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer text-center ${
													isSelected
														? "bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100"
														: "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700"
												}`}
											>
												{filterOption.label}
											</button>
										);
									})}
								</div>
							</div>

							{/* Tester */}
							<div>
								<label className="block text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase mb-2">
									Tester
								</label>
								<select
									value={testerFilter}
									onChange={(event) => setTesterFilter(event.target.value)}
									className="w-full rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-slate-600 dark:text-gray-400"
								>
									<option value="all">All testers</option>
									{testers.map((testerName) => (
										<option key={testerName} value={testerName}>
											{testerName}
										</option>
									))}
								</select>
							</div>

							{/* Date */}
							<div>
								<label className="block text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase mb-2">
									Date
								</label>
								<select
									value={dateFilter}
									onChange={(event) => setDateFilter(event.target.value)}
									className="w-full rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-slate-600 dark:text-gray-400"
								>
									<option value="all">All dates</option>
									<option value="today">Today</option>
									<option value="yesterday">Yesterday</option>
									<option value="7d">Last 7 days</option>
									<option value="30d">Last 30 days</option>
								</select>
							</div>

							{/* Session */}
							{sessions.length > 0 && (
								<div>
									<label className="block text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase mb-2">
										Session
									</label>
									<select
										value={sessionFilter}
										onChange={(event) => setSessionFilter(event.target.value)}
										className="w-full rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-slate-600 dark:text-gray-400"
									>
										<option value="all">All sessions</option>
										<option value="none">No session</option>
										{sessions.map((session) => (
											<option key={session.id} value={session.id}>
												{session.name}
											</option>
										))}
									</select>
								</div>
							)}

							{/* Sort */}
							<div>
								<label className="block text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase mb-2">
									Sort
								</label>
								<button
									onClick={() =>
										setSortOrder(
											sortOrder === "newest"
												? "oldest"
												: sortOrder === "oldest"
													? "default"
													: "newest",
										)
									}
									className={`w-full flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
										sortOrder !== "default"
											? "bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100"
											: "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700"
									}`}
								>
									<ArrowDownUp size={12} />
									{sortOrder === "newest"
										? "Newest first"
										: sortOrder === "oldest"
											? "Oldest first"
											: "Default order"}
								</button>
							</div>
						</div>

						<button
							onClick={closeSheet}
							className="mt-5 w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
						>
							Done
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
