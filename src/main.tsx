import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import AuthGate from "./components/AuthGate";
import NavBar from "./components/NavBar";
import ThemeToggle from "./components/ThemeToggle";
import SoundToggle from "./components/SoundToggle";
import { useActiveBugCount } from "./hooks/useActiveBugCount";
import { AuthProvider } from "./lib/auth";
import { TeamAccessProvider, useTeamAccess } from "./lib/teamAccess";
import { useAuth, getUserDisplayName } from "./lib/useAuth";
import PageLoader from "./components/PageLoader";
import ExtensionBridge from "./components/ExtensionBridge";
import { SessionTimerProvider } from "./lib/sessionTimer";
import SessionTimerBar from "./components/SessionTimerBar";
import { usePanelStore } from "./stores/panelStore";
import "./index.css";

const AppPage = lazy(() => import("./App"));
const SessionsListPage = lazy(() => import("./pages/SessionsListPage"));
const SessionSetupPage = lazy(() => import("./pages/SessionSetupPage"));
const PresentationPage = lazy(() => import("./pages/PresentationPage"));
const TesterManagementPage = lazy(() => import("./pages/TesterManagementPage"));
const TeamManagementPage = lazy(() => import("./pages/TeamManagementPage"));
const SettingsSidebar = lazy(() => import("./components/SettingsSidebar"));
const AiAssistantPanel = lazy(() => import("./components/AiAssistantPanel"));

function RouteFallback() {
	return <PageLoader />;
}

function Layout() {
	const { user, signOut } = useAuth();
	const { activeTeam, activeTeamId, teams, isGodMode, setActiveTeamId } =
		useTeamAccess();
	const [showBugs, setShowBugs] = React.useState(
		() => localStorage.getItem("showBugs") !== "false",
	);
	const activeBugCount = useActiveBugCount();
	const settingsOpen = usePanelStore((s) => s.settingsOpen);
	const aiPanelOpen = usePanelStore((s) => s.aiPanelOpen);
	const [aiPanelMounted, setAiPanelMounted] = React.useState(
		() => sessionStorage.getItem("aiPanelOpen") === "true",
	);

	React.useEffect(() => {
		if (aiPanelOpen) {
			setAiPanelMounted(true);
		}
	}, [aiPanelOpen]);

	React.useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "b") {
				event.preventDefault();
				setShowBugs((prev) => {
					const next = !prev;
					localStorage.setItem("showBugs", String(next));
					return next;
				});
			}
			if ((event.metaKey || event.ctrlKey) && event.key === "i") {
				event.preventDefault();
				usePanelStore.getState().toggleAiPanel();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const toggleBugs = () =>
		setShowBugs((prev) => {
			const next = !prev;
			localStorage.setItem("showBugs", String(next));
			return next;
		});

	const userDisplayName = getUserDisplayName(user ?? null);
	const metadata = user?.user_metadata as Record<string, unknown> | undefined;
	const metadataAvatar =
		typeof metadata?.avatar_url === "string" ? metadata.avatar_url.trim() : "";
	const metadataPicture =
		typeof metadata?.picture === "string" ? metadata.picture.trim() : "";
	const userAvatarUrl = metadataAvatar || metadataPicture || undefined;
	const handleLogout = () => {
		void signOut();
	};

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans">
			<ExtensionBridge />
			<NavBar
				showBugs={showBugs}
				onToggleBugs={toggleBugs}
				bugCount={activeBugCount}
				activeTeamName={activeTeam?.name}
				isGodMode={isGodMode}
				teamOptions={teams}
				activeTeamId={activeTeamId}
				onTeamChange={setActiveTeamId}
				showTeamsNav
				onOpenSettings={() => usePanelStore.getState().openSettings()}
				userDisplayName={userDisplayName}
				userEmail={user?.email}
				userAvatarUrl={userAvatarUrl}
				onLogout={handleLogout}
			>
				<ThemeToggle />
				<div className="hidden md:block">
					<SoundToggle />
				</div>
			</NavBar>
			<SessionTimerBar />
			<main
				className={`pb-16 md:pb-0 transition-[margin] duration-200 ease-in-out ${
					aiPanelOpen ? "lg:mr-[420px]" : ""
				}`}
			>
				<Outlet />
			</main>
			{settingsOpen && (
				<Suspense fallback={null}>
					<SettingsSidebar
						open={settingsOpen}
						onClose={() => usePanelStore.getState().closeSettings()}
					/>
				</Suspense>
			)}
			{aiPanelMounted && (
				<Suspense fallback={null}>
					<AiAssistantPanel
						open={aiPanelOpen}
						onClose={() => usePanelStore.getState().closeAiPanel()}
						onOpenSettings={() => {
							usePanelStore.getState().closeAiPanel();
							usePanelStore.getState().openSettings();
						}}
					/>
				</Suspense>
			)}
		</div>
	);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AuthGate>
					<TeamAccessProvider>
						<SessionTimerProvider>
							<BrowserRouter>
								<Routes>
									<Route element={<Layout />}>
										<Route
											path="/"
											element={
												<Suspense fallback={<RouteFallback />}>
													<AppPage />
												</Suspense>
											}
										/>
										<Route
											path="/sessions"
											element={
												<Suspense fallback={<RouteFallback />}>
													<SessionsListPage />
												</Suspense>
											}
										/>
										<Route
											path="/sessions/:id"
											element={
												<Suspense fallback={<RouteFallback />}>
													<SessionSetupPage />
												</Suspense>
											}
										/>
										<Route
											path="/testers"
											element={
												<Suspense fallback={<RouteFallback />}>
													<TesterManagementPage />
												</Suspense>
											}
										/>
										<Route
											path="/teams"
											element={
												<Suspense fallback={<RouteFallback />}>
													<TeamManagementPage />
												</Suspense>
											}
										/>
									</Route>
									<Route
										path="/sessions/:id/present"
										element={
											<Suspense fallback={<RouteFallback />}>
												<PresentationPage />
											</Suspense>
										}
									/>
								</Routes>
							</BrowserRouter>
						</SessionTimerProvider>
					</TeamAccessProvider>
				</AuthGate>
			</AuthProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
