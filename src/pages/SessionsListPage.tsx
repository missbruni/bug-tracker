import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
	Plus,
	Calendar,
	Users,
	FileText,
	Presentation,
	MessageSquareHeart,
	Star,
	ChevronDown,
	Trash2,
	Package,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useTeamAccess } from "../lib/teamAccess";
import { scopeToTeam, withTeamPayload } from "../lib/teamScope";
import type { Product } from "../components/TeamCard";
import { SESSION_STATUS_STYLES } from "../constants";
import FeedbackModal from "../components/FeedbackModal";
import SecondaryAppBar from "../components/SecondaryAppBar";
import type { SessionWithStats } from "../types";

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

	if (!sessionsData) return [];

	const enriched: Session[] = [];
	for (const s of sessionsData) {
		const { count: scCount } = await scopeToTeam(
			supabase
				.from("scenarios")
				.select("*", { count: "exact", head: true })
				.eq("session_id", s.id),
			activeTeamId,
		);
		const { count: asCount } = await scopeToTeam(
			supabase
				.from("assignments")
				.select("*", { count: "exact", head: true })
				.eq("session_id", s.id),
			activeTeamId,
		);
		let feedbackAvg = 0;
		let feedbackCount = 0;
		if (s.status === "completed") {
			const { data: fbData } = await scopeToTeam(
				supabase
					.from("session_feedback")
					.select("rating")
					.eq("session_id", s.id),
				activeTeamId,
			);
			if (fbData && fbData.length) {
				feedbackCount = fbData.length;
				feedbackAvg =
					fbData.reduce(
						(sum: number, f: { rating: number }) => sum + f.rating,
						0,
					) / fbData.length;
			}
		}
		enriched.push({
			...s,
			scenario_count: scCount ?? 0,
			assignment_count: asCount ?? 0,
			feedback_avg: feedbackAvg,
			feedback_count: feedbackCount,
		} as Session);
	}
	return enriched;
}

export default function SessionsListPage() {
	const queryClient = useQueryClient();
	const { activeTeamId } = useTeamAccess();
	const sessionsQueryKey = ['sessions', activeTeamId] as const;
	const { data: sessions = [], isLoading: loading } = useQuery({
		queryKey: sessionsQueryKey,
		queryFn: () => fetchSessions(activeTeamId),
	});
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newDate, setNewDate] = useState("");
	const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
	const [completeConfirmSession, setCompleteConfirmSession] =
		useState<Session | null>(null);
	const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
	const [deleteConfirmSession, setDeleteConfirmSession] =
		useState<Session | null>(null);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");
	const [search, setSearch] = useState("");
	const [creatingSession, setCreatingSession] = useState(false);
	const [deletingSession, setDeletingSession] = useState(false);
	const [newProductId, setNewProductId] = useState("");
	const [teamProducts, setTeamProducts] = useState<Product[]>([]);

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
	useEffect(() => {
		setTeamProducts(productsData || []);
		if (productsData?.length === 1) setNewProductId(productsData[0].id);
	}, [productsData]);

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
				setNewDate("");
				setNewProductId(teamProducts.length === 1 ? teamProducts[0].id : "");
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
				(prev || []).map((s) =>
					s.id === session.id ? { ...s, status: next as Session["status"] } : s,
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
			if (!error) queryClient.setQueryData(sessionsQueryKey, (prev: Session[]) => (prev || []).filter((s) => s.id !== id));
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
				(prev || []).map((s) =>
					s.id === completeConfirmSession.id
						? { ...s, status: "completed" }
						: s,
				),
			);
		setCompleteConfirmSession(null);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20 text-sm text-gray-500">
				Loading sessions...
			</div>
		);
	}

	return (
		<>
			<SecondaryAppBar
				description="Plan and run testing sessions — assign scenarios, track progress, and collect feedback."
				stats={<><span className="text-blue-600 dark:text-yellow-400 font-semibold">{sessions.filter(s => s.status === 'active').length} active</span> / {sessions.length} total</>}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search sessions..."
				actionButton={
					<button
						onClick={() => setShowCreate(true)}
						className="h-full flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-500 px-3 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 transition-colors cursor-pointer whitespace-nowrap"
					>
						<Plus size={14} />
						New Session
					</button>
				}
			/>

			<div className="max-w-screen-lg mx-auto px-4 sm:px-7 py-6">

			{showCreate && (
				<div className="mb-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-gray-900 p-5">
					<h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3">
						Create Session
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
						<input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Session name *"
							autoFocus
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
						/>
						<input
							type="date"
							value={newDate}
							onChange={(e) => setNewDate(e.target.value)}
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
						/>
						<select
							value={newProductId}
							onChange={(e) => setNewProductId(e.target.value)}
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
						>
							<option value="">Select product...</option>
							{teamProducts.map((p) => (
								<option key={p.id} value={p.id}>{p.name}</option>
							))}
						</select>
					</div>
					<div className="flex gap-2 justify-end">
						<button
							onClick={() => {
								if (creatingSession) return;
								setShowCreate(false);
								setNewName("");
								setNewDate("");
							}}
							disabled={creatingSession}
							className="rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
						>
							Cancel
						</button>
						<button
							onClick={createSession}
							disabled={!newName.trim() || creatingSession}
							className="rounded-md px-5 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 transition-colors cursor-pointer disabled:cursor-default"
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
							const q = search.toLowerCase();
							return session.name.toLowerCase().includes(q) || session.status.toLowerCase().includes(q);
						})
						.map((session) => {
						const st = SESSION_STATUS_STYLES[session.status];
						return (
							<Link
								key={session.id}
								to={`/sessions/${session.id}`}
								className="block rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
							>
								<div className="flex flex-col sm:flex-row sm:items-center gap-3">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 truncate sm:truncate break-words sm:break-normal whitespace-normal sm:whitespace-nowrap">
												{session.name}
											</h3>
											<div className="relative">
												<button
													onClick={(e) => {
														e.preventDefault();
														if (session.status !== "completed")
															setStatusMenuId(
																statusMenuId === session.id ? null : session.id,
															);
													}}
													disabled={session.status === "completed"}
													className={`badge ${st.bg} ${session.status === "completed" ? "cursor-default" : "cursor-pointer hover:opacity-80"} transition-opacity`}
												>
													{session.status}
													{session.status !== "completed" && (
														<ChevronDown size={10} />
													)}
												</button>
												{statusMenuId === session.id && (
													<>
														<div
															className="fixed inset-0 z-40"
															onClick={(e) => {
																e.preventDefault();
																setStatusMenuId(null);
															}}
														/>
														<div className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 min-w-[120px]">
															{(["draft", "active", "completed"] as const).map(
																(s) => {
																	const sty = SESSION_STATUS_STYLES[s];
																	return (
																		<button
																			key={s}
																			onClick={(e) => {
																				e.preventDefault();
																				setSessionStatus(session, s);
																			}}
																			className={`w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
																				session.status === s
																					? sty.bg
																					: "text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800"
																			}`}
																		>
																			{s}
																		</button>
																	);
																},
															)}
														</div>
													</>
												)}
											</div>
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
												const prod = teamProducts.find(p => p.id === session.product_id);
												if (!prod) return null;
												return (
													<span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
														<Package size={12} />
														{prod.name}
													</span>
												);
											})()}
										</div>
									</div>
									<div className="flex items-center gap-2 sm:shrink-0">
										<button
											onClick={(e) => {
												e.preventDefault();
												setDeleteConfirmSession(session);
												setDeleteConfirmText("");
											}}
											className="p-1.5 rounded-md text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
											title="Delete session"
										>
											<Trash2 size={14} />
										</button>
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
													onClick={(e) => {
														e.preventDefault();
														setFeedbackSession(session);
													}}
													className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
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
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					onClick={() => setCompleteConfirmSession(null)}
				>
					<div
						className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-2">
							Complete session?
						</h3>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-5 leading-relaxed">
							This will lock{" "}
							<span className="font-semibold text-slate-700 dark:text-gray-300">
								{completeConfirmSession.name}
							</span>
							. You will no longer be able to edit scenarios, reassign testers,
							or change the status. This action cannot be undone.
						</p>
						<div className="flex gap-2 justify-end">
							<button
								onClick={() => setCompleteConfirmSession(null)}
								className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={confirmComplete}
								className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 cursor-pointer transition-colors"
							>
								Yes, complete session
							</button>
						</div>
					</div>
				</div>
			)}
			{deleteConfirmSession && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					onClick={() => {
						if (deletingSession) return;
						setDeleteConfirmSession(null);
						setDeleteConfirmText("");
						setDeletingSession(false);
					}}
				>
					<div
						className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-6"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">
							Delete session?
						</h3>
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
							onChange={(e) => setDeleteConfirmText(e.target.value)}
							placeholder={deleteConfirmSession.name}
							autoFocus
							className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-red-400 dark:focus:border-red-500 mb-4 font-mono"
						/>
						<div className="flex gap-2 justify-end">
							<button
								onClick={() => {
									if (deletingSession) return;
									setDeleteConfirmSession(null);
									setDeleteConfirmText("");
									setDeletingSession(false);
								}}
								disabled={deletingSession}
								className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-default cursor-pointer transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={deleteSession}
								disabled={deleteConfirmText !== deleteConfirmSession.name || deletingSession}
								className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-gray-700 disabled:text-slate-500 dark:disabled:text-gray-500 cursor-pointer disabled:cursor-default transition-colors"
							>
								{deletingSession ? "Deleting..." : "Delete permanently"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
		</>
	);
}
