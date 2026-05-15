import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import PinGate from "./components/PinGate";
import NavBar from "./components/NavBar";
import ThemeToggle from "./components/ThemeToggle";
import SessionsListPage from "./pages/SessionsListPage";
import SessionSetupPage from "./pages/SessionSetupPage";
import PresentationPage from "./pages/PresentationPage";
import TesterManagementPage from "./pages/TesterManagementPage";
import SettingsSidebar from "./components/SettingsSidebar";
import AiAssistantPanel from "./components/AiAssistantPanel";
import { useActiveBugCount } from "./hooks/useActiveBugCount";
import "./index.css";

function Layout({ children }: { children: React.ReactNode }) {
	const [showBugs, setShowBugs] = useState(
		() => localStorage.getItem("showBugs") !== "false",
	);
	const activeBugCount = useActiveBugCount();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [aiPanelOpen, setAiPanelOpen] = useState(false);

	useEffect(() => {
		const handler = () => setSettingsOpen(true);
		window.addEventListener("openSettings", handler);
		return () => window.removeEventListener("openSettings", handler);
	}, []);

	useEffect(() => {
		const handler = () => setAiPanelOpen(true);
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

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans">
			<NavBar
				showBugs={showBugs}
				onToggleBugs={toggleBugs}
				bugCount={activeBugCount}
				onOpenSettings={() => setSettingsOpen(true)}
			>
				<ThemeToggle />
			</NavBar>
			<div
				className={`transition-[margin] duration-200 ease-in-out ${
					aiPanelOpen ? "lg:mr-[420px]" : ""
				}`}
			>
				{children}
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
		<PinGate>
			<HashRouter>
				<Routes>
					<Route
						path="/"
						element={
							<Layout>
								<App />
							</Layout>
						}
					/>
					<Route
						path="/sessions"
						element={
							<Layout>
								<SessionsListPage />
							</Layout>
						}
					/>
					<Route
						path="/sessions/:id"
						element={
							<Layout>
								<SessionSetupPage />
							</Layout>
						}
					/>
					<Route path="/sessions/:id/present" element={<PresentationPage />} />
					<Route
						path="/testers"
						element={
							<Layout>
								<TesterManagementPage />
							</Layout>
						}
					/>
				</Routes>
			</HashRouter>
		</PinGate>
	</React.StrictMode>,
);
