import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import PinGate from "./components/PinGate";
import NavBar from "./components/NavBar";
import ThemeToggle from "./components/ThemeToggle";
import { supabase } from "./supabaseClient";
import SessionsListPage from "./pages/SessionsListPage";
import SessionSetupPage from "./pages/SessionSetupPage";
import PresentationPage from "./pages/PresentationPage";
import TesterManagementPage from "./pages/TesterManagementPage";
import SettingsSidebar from "./components/SettingsSidebar";
import "./index.css";

function Layout({ children }: { children: React.ReactNode }) {
	const [showBugs, setShowBugs] = useState(
		() => localStorage.getItem("showBugs") !== "false",
	);
	const [activeBugCount, setActiveBugCount] = useState(3);
	const [settingsOpen, setSettingsOpen] = useState(false);

	useEffect(() => {
		const handler = () => setSettingsOpen(true);
		window.addEventListener("openSettings", handler);
		return () => window.removeEventListener("openSettings", handler);
	}, []);

	useEffect(() => {
		if (!supabase) return;
		const sb = supabase;
		const fetchCount = async () => {
			const { count } = await sb
				.from("bugs")
				.select("*", { count: "exact", head: true })
				.eq("reviewed", false);
			if (count !== null) setActiveBugCount(count);
		};
		fetchCount();
		const channel = sb
			.channel("layout-bugs-count")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "bugs" },
				() => fetchCount(),
			)
			.subscribe();
		return () => {
			sb.removeChannel(channel);
		};
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
			{children}
			<SettingsSidebar
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
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
