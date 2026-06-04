import React from "react"
import { Link } from "react-router-dom";
import {
	Plus,
	Calendar,
	Users,
	FileText,
	Presentation,
	MessageSquareHeart,
	Star,
	Trash2,
	Package,
	Play,
	Copy,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useTeamAccess } from "../lib/teamAccess";
import { scopeToTeam, withTeamPayload } from "../lib/teamScope";
import type { Product } from "../domains/teams/model";
import { SESSION_STATUS_STYLES } from "../constants";
import FeedbackModal from "../components/FeedbackModal";
import StatusMenu from "../components/StatusMenu";
import ConfirmModal from "../components/ConfirmModal";
import SecondaryAppBar from "../components/SecondaryAppBar";
import { SessionListSkeleton } from "../components/Skeleton";
import CloneSessionModal from "../components/CloneSessionModal";
import Tooltip from "../components/Tooltip";
import { useSessionTimer } from "../domains/sessions/sessionTimer";
import type { SessionWithStats } from "../domains/sessions/model";

type Session = SessionWithStats;

async function fetchSessions(activeTeamId: string | null): Promise<Session[]> {
	if (!supabase) return [];
	const { data: sessionsData } = await scopeToTeam(
		supabase
			.from("sessions")
			.select("*")
			.order("created_at", { ascending: false }),
		activeTeamId,
	);

	if (!sessionsData?.length) return [];

	const sessionIds = sessionsData.map((s) => s.id);
	const completedIds = sessionsData.filter((s) => s.status === "completed").map((s) => s.id);

	// Bulk-fetch counts and feedback in 3 parallel queries instead of per-session
	const [scenarioRes, assignmentRes, feedbackRes] = await Promise.all([
		scopeToTeam(
			supabase.from("scenarios").select("session_id").in("session_id", sessionIds),
			activeTeamId,
		),
		scopeToTeam(
			supabase.from("assignments").select("session_id").in("session_id", sessionIds),
			activeTeamId,
		),
		completedIds.length
			? scopeToTeam(
					supabase.from("session_feedback").select("session_id, rating").in("session_id", completedIds),
					activeTeamId,
				)
			: { data: [] },
	]);

	// Build count maps
	const scenarioCounts = new Map<string, number>();
	for (const row of scenarioRes.data || []) {
		scenarioCounts.set(row.session_id, (scenarioCounts.get(row.session_id) || 0) + 1);
	}
	const assignmentCounts = new Map<string, number>();
	for (const row of assignmentRes.data || []) {
		assignmentCounts.set(row.session_id, (assignmentCounts.get(row.session_id) || 0) + 1);
	}
	const feedbackBySession = new Map<string, number[]>();
	for (const row of (feedbackRes.data || []) as { session_id: string; rating: number }[]) {
		const arr = feedbackBySession.get(row.session_id) || [];
		arr.push(row.rating);
		feedbackBySession.set(row.session_id, arr);
	}

	return sessionsData.map((sessionRow) => {
		const ratings = feedbackBySession.get(sessionRow.id) || [];
		return {
			...sessionRow,
			scenario_count: scenarioCounts.get(sessionRow.id) || 0,
			assignment_count: assignmentCounts.get(sessionRow.id) || 0,
			feedback_avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
			feedback_count: ratings.length,
		} as Session;
	});
}

export default function SessionsListPage() {
	const queryClient = useQueryClient();
	const { activeTeamId, activeTeam } = useTeamAccess();
	const { timer, startTimer } = useSessionTimer();
	const sessionsQueryKey = ['sessions', activeTeamId] as const;
	const { data: sessions = [], isLoading: loading } = useQuery({
		queryKey: sessionsQueryKey,
		queryFn: () => fetchSessions(activeTeamId),
	});
	const [showCreate, setShowCreate] = React.useState(false);
	const [newName, setNewName] = React.useState("");
	const [newDate, setNewDate] = React.useState(() => new Date().toISOString().split("T")[0]);
	const [feedbackSession, setFeedbackSession] = React.useState<Session | null>(null);
	const [completeConfirmSession, setCompleteConfirmSession] =
		React.useState<Session | null>(null);
	const [statusMenuId, setStatusMenuId] = React.useState<string | null>(null);
	const [deleteConfirmSession, setDeleteConfirmSession] =
		React.useState<Session | null>(null);
	const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
	const [search, setSearch] = React.useState("");
	const [creatingSession, setCreatingSession] = React.useState(false);
	const [deletingSession, setDeletingSession] = React.useState(false);
	const [cloneSession, setCloneSession] = React.useState<Session | null>(null);
	const [newProductId, setNewProductId] = React.useState("");
	const [teamProducts, setTeamProducts] = React.useState<Product[]>([]);

	// Load products for the active team
	const { data: productsData } = useQuery({
		queryKey: ['products', activeTeamId],
		queryFn: async () => {
			if (!supabase) return [];
			const { data } = await scopeToTeam(
				supabase.from('products').select('id, team_id, name, slug, description, link').order('name'),
				activeTeamId,
			);
			return (data || []) as Product[];
		},
	});

	// Keep local state in sync
	React.useEffect(() => {
		const products = productsData || [];
		setTeamProducts(products);
		const defaultId = activeTeam?.default_product_id ?? null;
		if (defaultId && products.some((p) => p.id === defaultId)) {
			setNewProductId(defaultId);
		} else if (products.length === 1) {
			setNewProductId(products[0].id);
		}
	}, [productsData, activeTeam?.default_product_id]);

	const createSession = async () => {
		if (!supabase || !newName.trim() || creatingSession) return;
		setCreatingSession(true);
		try {
			const payload: Record<string, unknown> = { name: newName.trim(), date: newDate || null, status: "draft" };
			if (newProductId) payload.product_id = newProductId;
			const { data, error } = await supabase
				.from("sessions")
				.insert(withTeamPayload(payload, activeTeamId))
				.select();
			if (!error && data?.[0]) {
				queryClient.setQueryData(sessionsQueryKey, (prev: Session[]) => [
					{ ...data[0], scenario_count: 0, assignment_count: 0 } as Session,
					...(prev || []),
				]);
				setNewName("");
				setNewDate(new Date().toISOString().split("T")[0]);
				const defaultId = activeTeam?.default_product_id ?? null;
				if (defaultId && teamProducts.some((p) => p.id === defaultId)) {
					setNewProductId(defaultId);
				} else {
					setNewProductId(teamProducts.length === 1 ? teamProducts[0].id : "");
				}
				setShowCreate(false);
			}
		} finally {
			setCreatingSession(false);
		}
	};

	const setSessionStatus = async (session: Session, next: string) => {
		if (!supabase) return;
		setStatusMenuId(null);
		if (next === "completed") {
			setCompleteConfirmSession(session);
			return;
		}
		const statusQuery = scopeToTeam(
			supabase
				.from("sessions")
				.update({ status: next })
				.eq("id", session.id),
			activeTeamId,
		);
		const { error } = await statusQuery;
		if (!error)
			queryClient.setQueryData(sessionsQueryKey, (prev: Session[]) =>
				(prev || []).map((existingSession) =>
					existingSession.id === session.id ? { ...existingSession, status: next as Session["status"] } : existingSession,
				),
			);
	};

	const deleteSession = async () => {
		if (!supabase || !deleteConfirmSession || deletingSession) return;
		setDeletingSession(true);
		try {
			const id = deleteConfirmSession.id;
			// Delete related data first, then the session
			await scopeToTeam(supabase.from("assignments").delete().eq("session_id", id), activeTeamId);
			await scopeToTeam(supabase.from("scenarios").delete().eq("session_id", id), activeTeamId);
			await scopeToTeam(supabase.from("session_feedback").delete().eq("session_id", id), activeTeamId);
			const deleteQuery = scopeToTeam(
				supabase.from("sessions").delete().eq("id", id),
				activeTeamId,
			);
			const { error } = await deleteQuery;
			if (!error) queryClient.setQueryData(sessionsQueryKey, (prev: Session[]) => (prev || []).filter((existingSession) => existingSession.id !== id));
			setDeleteConfirmSession(null);
			setDeleteConfirmText("");
		} finally {
			setDeletingSession(false);
		}
	};

	const confirmComplete = async () => {
		if (!supabase || !completeConfirmSession) return;
		const completeQuery = scopeToTeam(
			supabase
				.from("sessions")
				.update({ status: "completed" })
				.eq("id", completeConfirmSession.id),
			activeTeamId,
		);
		const { error } = await completeQuery;
		if (!error)
			queryClient.setQueryData(sessionsQueryKey, (prev: Session[]) =>
				(prev || []).map((existingSession) =>
					existingSession.id === completeConfirmSession.id
						? { ...existingSession, status: "completed" }
						: existingSession,
				),
			);
		setCompleteConfirmSession(null);
	};

	return (
		<>
			<SecondaryAppBar
				description=""
				stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{sessions.filter(session => session.status === 'active').length} active</span> / {sessions.length} total</>}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search sessions..."
				actionButton={
					<div className="flex h-full items-center gap-2">
						<Link
							to="/participants"
							className="h-full flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-gray-700 px-3 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
						>
							<Users size={14} />
							Participants
						</Link>
						<button
							onClick={() => setShowCreate(true)}
							className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
						>
							<Plus size={14} />
							New Session
						</button>
					</div>
				}
			/>

			<div className="max-w-screen-lg mx-auto px-4 sm:px-7 py-6">

			<div className="mb-6">
				<h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase tracking-tight">Testing Sessions</h1>
				<p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Initialize squad deployments and scenario parameters.</p>
			</div>

			{loading ? (
				<SessionListSkeleton />
			) : (<>
			{showCreate && (
				<div className="mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5">
					<h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3">
						Create Session
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
						<input
							value={newName}
							onChange={(event) => setNewName(event.target.value)}
							placeholder="Session name *"
							autoFocus
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
						/>
						<input
							type="date"
							value={newDate}
							onChange={(event) => setNewDate(event.target.value)}
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
						/>
						<select
							value={newProductId}
							onChange={(event) => setNewProductId(event.target.value)}
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
						>
							<option value="">Select product...</option>
							{teamProducts.map((product) => (
								<option key={product.id} value={product.id}>{product.name}</option>
							))}
						</select>
					</div>
					<div className="flex gap-2 justify-end">
						<button
							onClick={() => {
								if (creatingSession) return;
								setShowCreate(false);
								setNewName("");
								setNewDate(new Date().toISOString().split("T")[0]);
							}}
							disabled={creatingSession}
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
						>
							Cancel
						</button>
						<button
							onClick={createSession}
							disabled={!newName.trim() || creatingSession}
							className="rounded-md px-5 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default"
						>
							{creatingSession ? "Creating..." : "Create"}
						</button>
					</div>
				</div>
			)}

			{sessions.length === 0 ? (
				<div className="text-center py-16 text-slate-400 dark:text-gray-600">
					<Presentation size={48} className="mx-auto mb-3 opacity-40" />
					<p className="text-sm">No sessions yet. Create one to get started.</p>
				</div>
			) : (
				<div className="space-y-2">
					{sessions
						.filter(session => {
							if (!search.trim()) return true;
							const query = search.toLowerCase();
							return session.name.toLowerCase().includes(query) || session.status.toLowerCase().includes(query);
						})
						.map((session) => {
						const st = SESSION_STATUS_STYLES[session.status];
						return (
							<Link
								key={session.id}
								to={`/sessions/${session.id}`}
								className="card block rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
								style={{ borderLeft: `4px solid ${st.border}` }}
							>
								<div className="flex flex-col sm:flex-row sm:items-center gap-3">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<h2 className="text-sm font-bold text-slate-900 dark:text-gray-100 truncate sm:truncate break-words sm:break-normal whitespace-normal sm:whitespace-nowrap">
												{session.name}
											</h2>
											<StatusMenu
												currentStatus={session.status}
												open={statusMenuId === session.id}
												onToggle={() => setStatusMenuId(statusMenuId === session.id ? null : session.id)}
												onSelect={(s) => setSessionStatus(session, s)}
												onClose={() => setStatusMenuId(null)}
												disabled={session.status === "completed"}
											/>
										</div>
										<div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-gray-500">
											{session.date && (
												<span className="flex items-center gap-1">
													<Calendar size={12} />
													{new Date(session.date).toLocaleDateString("en-GB", {
														day: "numeric",
														month: "short",
														year: "numeric",
													})}
												</span>
											)}
											<span className="flex items-center gap-1">
												<FileText size={12} />
												{session.scenario_count} scenario
												{session.scenario_count !== 1 ? "s" : ""}
											</span>
											<span className="flex items-center gap-1">
												<Users size={12} />
												{session.assignment_count} assigned
											</span>
											{session.product_id && (() => {
												const product = teamProducts.find(existingProduct => existingProduct.id === session.product_id);
												if (!product) return null;
												return (
													<span className="flex items-center gap-1 text-violet-600 dark:text-mushi-tertiary">
														<Package size={12} />
														{product.name}
													</span>
												);
											})()}
										</div>
									</div>
									<div className="flex items-center gap-2 sm:shrink-0">
										{session.status !== "completed" && !timer && (
											<button
												onClick={(event) => {
													event.preventDefault();
													startTimer(session.id, session.name);
												}}
												className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer"
												title="Start session timer"
											>
												<Play size={12} /> Start
											</button>
										)}
										<Tooltip title="Duplicate session">
											<button
												onClick={(event) => {
														event.preventDefault();
														setCloneSession(session);
												}}
												className="p-1.5 rounded-md text-slate-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
											>
												<Copy size={14} />
										</button>
										</Tooltip>
										<Tooltip title="Delete">
											<button
												onClick={(event) => {
														event.preventDefault();
														setDeleteConfirmSession(session);
														setDeleteConfirmText("");
												}}
												className="p-1.5 rounded-md text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
											aria-label="Delete"
											>
												<Trash2 size={14} />
										</button>
										</Tooltip>
										{session.status === "completed" && (
											<div className="flex items-center gap-3 shrink-0">
												{(session.feedback_count ?? 0) > 0 && (
													<div className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400">
														<Star
															size={14}
															className="fill-yellow-400 text-yellow-400"
														/>
														<span className="font-bold">
															{(session.feedback_avg ?? 0).toFixed(1)}
														</span>
														<span className="text-slate-400 dark:text-gray-500">
															({session.feedback_count})
														</span>
													</div>
												)}
												<button
													onClick={(event) => {
														event.preventDefault();
														setFeedbackSession(session);
													}}
													className="flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
												>
													<MessageSquareHeart size={14} />
													Feedback
												</button>
											</div>
										)}
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			)}
			</>)}
			{feedbackSession && (
				<FeedbackModal
					sessionId={feedbackSession.id}
					sessionName={feedbackSession.name}
					onClose={() => {
						setFeedbackSession(null);
						queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
					}}
				/>
			)}
			{completeConfirmSession && (
				<ConfirmModal
					title="Complete session?"
					confirmLabel="Yes, complete session"
					onConfirm={confirmComplete}
					onCancel={() => setCompleteConfirmSession(null)}
				>
					<p className="text-xs text-slate-500 dark:text-gray-400 mb-5 leading-relaxed">
						This will lock{" "}
						<span className="font-semibold text-slate-700 dark:text-gray-300">
							{completeConfirmSession.name}
						</span>
						. You will no longer be able to edit scenarios, reassign testers,
						or change the status. This action cannot be undone.
					</p>
				</ConfirmModal>
			)}
			{deleteConfirmSession && (
				<ConfirmModal
					title="Delete session?"
					titleClassName="text-sm font-bold text-red-600 dark:text-red-400 mb-2"
					confirmLabel="Delete permanently"
					confirmClassName="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-on-danger hover:bg-red-600 cursor-pointer transition-colors"
					onConfirm={deleteSession}
					onCancel={() => { setDeleteConfirmSession(null); setDeleteConfirmText(""); setDeletingSession(false) }}
					disabled={deleteConfirmText !== deleteConfirmSession.name}
					loading={deletingSession}
				>
					<p className="text-xs text-slate-500 dark:text-gray-400 mb-3 leading-relaxed">
						This will permanently delete this session
						and all its scenarios, assignments, and feedback. This action
						cannot be undone.
					</p>
					<p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
						Type{" "}
						<span className="font-mono font-bold text-red-500">{deleteConfirmSession.name}</span>{" "}
						to confirm:
					</p>
					<input
						value={deleteConfirmText}
						onChange={(event) => setDeleteConfirmText(event.target.value)}
						placeholder={deleteConfirmSession.name}
						autoFocus
						className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-red-400 dark:focus:border-red-500 mb-4 font-mono"
					/>
				</ConfirmModal>
			)}
		{cloneSession && (
			<CloneSessionModal
				session={cloneSession}
				activeTeamId={activeTeamId}
				onCloned={(newId) => {
					setCloneSession(null);
					queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
					window.location.href = `/sessions/${newId}`;
				}}
				onClose={() => setCloneSession(null)}
			/>
		)}
		</div>
		</>
	);
}
