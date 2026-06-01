import React, { type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom";
import { Bug, Presentation, Users, Settings, Sparkles, LogOut, Building2, UserCircle, BarChart3 } from "lucide-react";
import BottomSheet from "./BottomSheet";
import CrawlingBugs from "../CrawlingBugs";
import Logo from "./Logo";
import type { TeamRecord } from "../lib/teamScope";
import { getFlySwatCursor } from "../lib/flySwatCursor";
import { playToggleSound } from "../lib/audio";
import { usePanelStore } from "../stores/panelStore";

const NAV_ITEMS = [
	{ to: "/", label: "Bugs", icon: Bug },
	{ to: "/sessions", label: "Sessions", icon: Presentation },
	{ to: "/testers", label: "Testers", icon: Users },
];

function getInitials(value: string): string {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return "?";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
}

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
	userDisplayName,
	userEmail,
	userAvatarUrl,
	onBugKill,
	onLogout,
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
	userDisplayName?: string;
	userEmail?: string;
	userAvatarUrl?: string;
	onBugKill?: () => void;
	onLogout?: () => void;
}) {
	const navItems = showTeamsNav
		? [...NAV_ITEMS, { to: "/teams", label: "Teams", icon: Building2 }, { to: "/analytics", label: "Analytics", icon: BarChart3 }]
		: [...NAV_ITEMS, { to: "/analytics", label: "Analytics", icon: BarChart3 }];

	const location = useLocation();
	const tabRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
	const [indicatorStyle, setIndicatorStyle] = React.useState<{ left: number; width: number }>({ left: 0, width: 0 });

	const isDark = usePanelStore((s) => s.isDark);

	const [profileOpen, setProfileOpen] = React.useState(false);

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
			<nav
			className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800"
			style={showBugs ? { cursor: getFlySwatCursor(isDark) } : undefined}
		>
				{showBugs && <div className="absolute inset-0 overflow-hidden pointer-events-auto"><CrawlingBugs count={bugCount} onKill={onBugKill} /></div>}
				<div className="max-w-screen-2xl mx-auto px-4 sm:px-7 flex items-center gap-3 sm:gap-4 relative z-10">
					{/* Branding */}
					<div className="flex items-center gap-3 py-3 shrink-0">
						<Logo showBugs={showBugs} onToggleBugs={onToggleBugs} />
						<span className="hidden min-[1230px]:inline text-xs font-semibold text-slate-400 dark:text-gray-500">
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
									data-tour-id={to === '/' ? 'nav-bugs' : undefined}
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
						<div className="ml-auto flex items-center gap-1.5 sm:gap-2 cursor-default">
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
								onClick={() => usePanelStore.getState().toggleAiPanel()}
								data-tour-id="ai-button"
								className="flex items-center gap-1.5 rounded-full border border-blue-500 dark:border-mushi-primary bg-blue-50 dark:bg-mushi-primary/10 px-2 sm:px-3 py-1 text-blue-600 dark:text-mushi-primary hover:bg-blue-100 dark:hover:bg-mushi-primary/20 transition-colors cursor-pointer"
								title="AI Assistant (⌘I)"
							>
								<Sparkles size={14} />
								<span className="text-xs font-bold">AI</span>
							</button>
							{userDisplayName && (
								<div className="relative">
									<button
										onClick={() => setProfileOpen((prev) => !prev)}
										data-tour-id="profile-button"
										className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 sm:px-2 py-1 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
										title={userEmail || userDisplayName}
										aria-label="Profile menu"
									>
										{userAvatarUrl ? (
											<img
												src={userAvatarUrl}
												alt={`${userDisplayName} avatar`}
												className="h-6 w-6 rounded-full object-cover"
												referrerPolicy="no-referrer"
											/>
										) : (
											<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-gray-700 text-[10px] font-bold text-slate-700 dark:text-gray-200">
												{getInitials(userDisplayName)}
											</span>
										)}
										<span className="hidden xl:inline max-w-[140px] truncate text-xs font-semibold text-slate-600 dark:text-gray-300">
											{userDisplayName}
										</span>
									</button>
									{/* Desktop dropdown */}
									{profileOpen && (
										<div className="hidden md:block">
											<div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
											<div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
												<div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-gray-800">
													<p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{userDisplayName}</p>
													{userEmail && (
														<p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-0.5">{userEmail}</p>
													)}
												</div>
												<Link
													to="/profile"
													onClick={() => setProfileOpen(false)}
													className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
												>
													<UserCircle size={14} />
													Edit profile
												</Link>
												{onLogout && (
													<button
														onClick={() => { setProfileOpen(false); onLogout() }}
														className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
													>
														<LogOut size={14} />
														Logout
													</button>
												)}
											</div>
										</div>
									)}

								</div>
							)}
							{children}
							{onOpenSettings && (
								<button
									onClick={() => { playToggleSound(false); onOpenSettings?.() }}
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

			{/* Mobile profile bottom sheet — rendered outside nav & tab bar so it layers above both */}
			{profileOpen && userDisplayName && (
				<BottomSheet onClose={() => setProfileOpen(false)} className="md:hidden z-60">
					<div className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-gray-800 -mt-1 mb-1">
						{userAvatarUrl ? (
							<img
								src={userAvatarUrl}
								alt={`${userDisplayName} avatar`}
								className="h-10 w-10 rounded-full object-cover"
								referrerPolicy="no-referrer"
							/>
						) : (
							<span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-gray-700 text-sm font-bold text-slate-700 dark:text-gray-200">
								{getInitials(userDisplayName)}
							</span>
						)}
						<div className="min-w-0">
							<p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{userDisplayName}</p>
							{userEmail && (
								<p className="text-xs text-slate-500 dark:text-gray-400 truncate">{userEmail}</p>
							)}
						</div>
					</div>
					<Link
						to="/profile"
						onClick={() => setProfileOpen(false)}
						className="w-full flex items-center gap-3 py-3.5 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors cursor-pointer rounded-md"
					>
						<UserCircle size={18} />
						Edit profile
					</Link>
					{onLogout && (
						<button
							onClick={() => { setProfileOpen(false); onLogout() }}
							className="w-full flex items-center gap-3 py-3.5 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors cursor-pointer rounded-md"
						>
							<LogOut size={18} />
							Logout
						</button>
					)}
				</BottomSheet>
			)}
		</>
	);
}
