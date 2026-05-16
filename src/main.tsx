import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import AuthGate from "./components/AuthGate";
import NavBar from "./components/NavBar";
import ThemeToggle from "./components/ThemeToggle";
import SessionsListPage from "./pages/SessionsListPage";
import SessionSetupPage from "./pages/SessionSetupPage";
import PresentationPage from "./pages/PresentationPage";
import TesterManagementPage from "./pages/TesterManagementPage";
import SettingsSidebar from "./components/SettingsSidebar";
import AiAssistantPanel from "./components/AiAssistantPanel";
import { useActiveBugCount } from "./hooks/useActiveBugCount";
import { playAiSound } from "./lib/audio";
import { AuthProvider } from "./lib/auth";
import { useAuth } from "./lib/useAuth";
import "./index.css";

function Layout() {
	const { user, signOut } = useAuth();
	const [showBugs, setShowBugs] = useState(
		() => localStorage.getItem("showBugs") !== "false",
	);
	const activeBugCount = useActiveBugCount();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [aiPanelOpen, setAiPanelOpen] = useState(
		() => sessionStorage.getItem("aiPanelOpen") === "true",
	);

	useEffect(() => {
		sessionStorage.setItem("aiPanelOpen", String(aiPanelOpen));
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
			<NavBar
				showBugs={showBugs}
				onToggleBugs={toggleBugs}
				bugCount={activeBugCount}
				onOpenSettings={() => setSettingsOpen(true)}
				userLabel={isMicrosoftAuthenticated ? userLabel : undefined}
				onLogout={isMicrosoftAuthenticated ? handleLogout : undefined}
				onLock={!isMicrosoftAuthenticated ? handlePinLock : undefined}
			>
				<ThemeToggle />
			</NavBar>
			<div
				className={`pb-16 sm:pb-0 transition-[margin] duration-200 ease-in-out ${
					aiPanelOpen ? "lg:mr-[420px]" : ""
				}`}
			>
				<Outlet />
			</div>
			<SettingsSidebar
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
			/>
			<AiAssistantPanel
				open={aiPanelOpen}
				onClose={() => setAiPanelOpen(false)}
				onOpenSettings={() => {
					setAiPanelOpen(false);
					setSettingsOpen(true);
				}}
			/>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AuthGate>
					<HashRouter>
						<Routes>
							<Route element={<Layout />}>
								<Route path="/" element={<App />} />
								<Route path="/sessions" element={<SessionsListPage />} />
								<Route path="/sessions/:id" element={<SessionSetupPage />} />
								<Route path="/testers" element={<TesterManagementPage />} />
							</Route>
							<Route path="/sessions/:id/present" element={<PresentationPage />} />
						</Routes>
					</HashRouter>
				</AuthGate>
			</AuthProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
