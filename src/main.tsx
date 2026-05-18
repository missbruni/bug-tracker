import React, { Suspense, lazy, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import AuthGate from "./components/AuthGate";
import NavBar from "./components/NavBar";
import ThemeToggle from "./components/ThemeToggle";
import { useActiveBugCount } from "./hooks/useActiveBugCount";
import { playAiSound } from "./lib/audio";
import { AuthProvider } from "./lib/auth";
import { TeamAccessProvider, useTeamAccess } from "./lib/teamAccess";
import { useAuth } from "./lib/useAuth";
import PageLoader from "./components/PageLoader";
import ExtensionBridge from "./components/ExtensionBridge";
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
	const { activeTeam, activeTeamId, teams, isGodMode, setActiveTeamId } = useTeamAccess();
	const [showBugs, setShowBugs] = useState(
		() => localStorage.getItem("showBugs") !== "false",
	);
	const activeBugCount = useActiveBugCount();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [aiPanelOpen, setAiPanelOpen] = useState(
		() => sessionStorage.getItem("aiPanelOpen") === "true",
	);
	const [aiPanelMounted, setAiPanelMounted] = useState(
		() => sessionStorage.getItem("aiPanelOpen") === "true",
	);

	useEffect(() => {
		sessionStorage.setItem("aiPanelOpen", String(aiPanelOpen));
	}, [aiPanelOpen]);

	useEffect(() => {
		if (aiPanelOpen) {
			setAiPanelMounted(true);
		}
	}, [aiPanelOpen]);

	useEffect(() => {
		const handler = () => setSettingsOpen(true);
		window.addEventListener("openSettings", handler);
		return () => window.removeEventListener("openSettings", handler);
	}, []);

	useEffect(() => {
		const handler = () => setAiPanelOpen((prev) => { playAiSound(prev === false); return !prev });
		window.addEventListener("openAiAssistant", handler);
		return () => window.removeEventListener("openAiAssistant", handler);
	}, []);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "b") {
				e.preventDefault();
				setShowBugs((prev) => {
					const next = !prev;
					localStorage.setItem("showBugs", String(next));
					return next;
				});
			}
			if ((e.metaKey || e.ctrlKey) && e.key === "i") {
				e.preventDefault();
				setAiPanelOpen((prev) => { playAiSound(!prev); return !prev });
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

	const metadataName =
		typeof user?.user_metadata?.name === "string"
			? user.user_metadata.name.trim()
			: "";
	const userLabel = metadataName || user?.email;
	const isMicrosoftAuthenticated = Boolean(user);

	const handleLogout = () => {
		void signOut();
	};

	const handlePinLock = () => {
		window.dispatchEvent(new CustomEvent("pin-lock"));
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
				showTeamsNav={isGodMode}
				onOpenSettings={() => setSettingsOpen(true)}
				userLabel={isMicrosoftAuthenticated ? userLabel : undefined}
				onLogout={isMicrosoftAuthenticated ? handleLogout : undefined}
				onLock={!isMicrosoftAuthenticated ? handlePinLock : undefined}
			>
				<ThemeToggle />
			</NavBar>
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
						onClose={() => setSettingsOpen(false)}
					/>
				</Suspense>
			)}
			{aiPanelMounted && (
				<Suspense fallback={null}>
					<AiAssistantPanel
						open={aiPanelOpen}
						onClose={() => setAiPanelOpen(false)}
						onOpenSettings={() => {
							setAiPanelOpen(false);
							setSettingsOpen(true);
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
						<BrowserRouter>
							<Routes>
								<Route element={<Layout />}>
									<Route path="/" element={<Suspense fallback={<RouteFallback />}><AppPage /></Suspense>} />
									<Route path="/sessions" element={<Suspense fallback={<RouteFallback />}><SessionsListPage /></Suspense>} />
									<Route path="/sessions/:id" element={<Suspense fallback={<RouteFallback />}><SessionSetupPage /></Suspense>} />
									<Route path="/testers" element={<Suspense fallback={<RouteFallback />}><TesterManagementPage /></Suspense>} />
									<Route path="/teams" element={<Suspense fallback={<RouteFallback />}><TeamManagementPage /></Suspense>} />
								</Route>
								<Route path="/sessions/:id/present" element={<Suspense fallback={<RouteFallback />}><PresentationPage /></Suspense>} />
							</Routes>
						</BrowserRouter>
					</TeamAccessProvider>
				</AuthGate>
			</AuthProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
