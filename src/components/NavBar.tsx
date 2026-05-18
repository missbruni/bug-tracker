import React, { type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom";
import { Bug, Presentation, Users, Settings, Sparkles, LogOut, Lock, Building2 } from "lucide-react";
import CrawlingBugs from "../CrawlingBugs";
import Logo from "./Logo";
import type { TeamRecord } from "../lib/teamScope";

const NAV_ITEMS = [
	{ to: "/", label: "Bugs", icon: Bug },
	{ to: "/sessions", label: "Sessions", icon: Presentation },
	{ to: "/testers", label: "Testers", icon: Users },
];

export default function NavBar({
	children,
	showBugs,
	onToggleBugs,
	bugCount,
	activeTeamName,
	isGodMode,
	teamOptions,
	activeTeamId,
	onTeamChange,
	showTeamsNav,
	onOpenSettings,
	userLabel,
	onLogout,
	onLock,
}: {
	children?: ReactNode;
	showBugs?: boolean;
	onToggleBugs?: () => void;
	bugCount?: number;
	activeTeamName?: string;
	isGodMode?: boolean;
	teamOptions?: TeamRecord[];
	activeTeamId?: string | null;
	onTeamChange?: (teamId: string) => void;
	showTeamsNav?: boolean;
	onOpenSettings?: () => void;
	userLabel?: string;
	onLogout?: () => void;
	onLock?: () => void;
}) {
	const navItems = showTeamsNav
		? [...NAV_ITEMS, { to: "/teams", label: "Teams", icon: Building2 }]
		: NAV_ITEMS;

	const location = useLocation();
	const tabRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
	const [indicatorStyle, setIndicatorStyle] = React.useState<{ left: number; width: number }>({ left: 0, width: 0 });

	const activeIndex = navItems.findIndex(({ to }) =>
		to === "/" ? location.pathname === "/" : location.pathname.startsWith(to)
	);

	React.useEffect(() => {
		const el = tabRefs.current[activeIndex];
		if (el) {
			setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
		}
	}, [activeIndex]);

	return (
		<>
			{/* ─── Top Nav Bar ─── */}
			<nav className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 overflow-hidden">
				{showBugs && <CrawlingBugs count={bugCount} />}
				<div className="max-w-screen-2xl mx-auto px-4 sm:px-7 flex items-center gap-3 sm:gap-4 relative z-10">
					{/* Branding */}
					<div className="flex items-center gap-3 py-3 shrink-0">
						<Logo showBugs={showBugs} onToggleBugs={onToggleBugs} />
						<span className="hidden lg:inline text-xs font-semibold text-slate-400 dark:text-gray-500">
							Catch every bug before your users do.
						</span>
					</div>
					{/* Desktop Tabs — hidden on mobile */}
					<div className="relative hidden md:flex items-center gap-1">
						{navItems.map(({ to, label, icon: Icon }, i) => {
							const active = i === activeIndex;
							return (
								<Link
									key={to}
									to={to}
									ref={(el) => { tabRefs.current[i] = el; }}
									className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide font-heading border-b-2 border-transparent transition-colors ${
										active
											? "text-blue-600 dark:text-blue-400"
											: "text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"
									}`}
								>
									<Icon size={14} />
									{label}
								</Link>
							);
						})}
						{/* Sliding indicator */}
						<div
							className="absolute bottom-0 h-0.5 bg-blue-500 rounded-full transition-all duration-200 ease-out"
							style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
						/>
					</div>
					{children && (
						<div className="ml-auto flex items-center gap-2">
							{activeTeamName && (
								<span
									className="hidden lg:inline whitespace-nowrap badge badge-slate"
									title={`Active team: ${activeTeamName}`}
								>
									Team: {activeTeamName}
								</span>
							)}
							{isGodMode && teamOptions && teamOptions.length > 1 && onTeamChange && (
								<select
									value={activeTeamId ?? ""}
									onChange={(event) => onTeamChange(event.target.value)}
									className="max-w-[180px] rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-slate-700 dark:text-gray-200"
									title="Switch active team"
								>
									{teamOptions.map((team) => (
										<option key={team.id} value={team.id}>
											{team.name}
										</option>
									))}
								</select>
							)}
							<button
								onClick={() => window.dispatchEvent(new CustomEvent('openAiAssistant'))}
								className="flex items-center gap-1.5 rounded-full border border-blue-500 dark:border-mushi-primary bg-blue-50 dark:bg-mushi-primary/10 px-3 py-1 text-blue-600 dark:text-mushi-primary hover:bg-blue-100 dark:hover:bg-mushi-primary/20 transition-colors cursor-pointer"
								title="AI Assistant (⌘I)"
							>
								<Sparkles size={14} />
								<span className="text-xs font-bold">AI</span>
							</button>
							{userLabel && (
								<span
									className="hidden lg:inline max-w-[220px] truncate text-xs text-slate-500 dark:text-gray-400"
									title={userLabel}
								>
									{userLabel}
								</span>
							)}
							{onLogout && (
								<button
									onClick={onLogout}
									className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-gray-700 px-3 py-1 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
									title="Logout"
								>
									<LogOut size={14} />
									<span className="hidden md:inline text-xs font-semibold">Logout</span>
								</button>
							)}
							{onLock && (
								<button
									onClick={onLock}
									className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-gray-700 px-3 py-1 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
									title="Lock"
								>
									<Lock size={14} />
									<span className="hidden md:inline text-xs font-semibold">Lock</span>
								</button>
							)}
							{children}
							{onOpenSettings && (
								<button
									onClick={onOpenSettings}
									className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
									title="Settings"
								>
									<Settings size={18} />
								</button>
							)}
						</div>
					)}
				</div>
			</nav>

			{/* ─── Mobile Bottom Tab Bar ─── */}
			<div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800">
				<div className="flex items-center justify-around">
					{navItems.map(({ to, label, icon: Icon }, i) => {
						const active = i === activeIndex;
						return (
							<Link
								key={to}
								to={to}
								className={`flex flex-col items-center gap-0.5 py-2 px-4 flex-1 text-center transition-colors ${
									active
										? "text-blue-600 dark:text-blue-400"
										: "text-slate-400 dark:text-gray-500"
								}`}
							>
								<Icon size={20} />
								<span className="text-[10px] font-semibold uppercase">{label}</span>
							</Link>
						);
					})}
				</div>
			</div>
		</>
	);
}
