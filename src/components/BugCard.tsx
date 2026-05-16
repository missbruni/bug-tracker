import { useRef, useState } from "react";
import {
	ChevronDown,
	ChevronRight,
	Paperclip,
	MessageSquare,
	Trash2,
	CheckCircle,
	Check,
	X,
	ExternalLink,
	Rocket,
	Pencil,
} from "lucide-react";
import { SEVERITY_STYLES } from "../constants";
import { TesterBadge } from "./TesterBadge";
import AttachmentCard from "./AttachmentCard";
import BugEditForm from "./BugEditForm";
import PublishMenu from "./PublishMenu";
import { useBugActions } from "../hooks/useBugActions";
import type { Bug } from "../types";

interface BugCardProps {
	bug: Bug;
	onUpdate: (bug: Bug) => void;
	onImageClick: (src: string, alt: string, type: string) => void;
	onDelete: (bugId: string) => void;
	onPersistError?: (message: string) => void;
	onReviewed?: (bug: Bug, undo: () => void) => void;
}

export default function BugCard({
	bug,
	onUpdate,
	onImageClick,
	onDelete,
	onPersistError,
	onReviewed,
}: BugCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [pendingDelete, setPendingDelete] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [commentText, setCommentText] = useState("");
	const [showCommentInput, setShowCommentInput] = useState(false);
	const [publishingMode, setPublishingMode] = useState<
		"backlog" | "devin" | null
	>(null);
	const [editing, setEditing] = useState(false);
	const publishing = publishingMode !== null;
	const fileRef = useRef<HTMLInputElement>(null);
	const style = SEVERITY_STYLES.dark[bug.severity];
	const backlogUrl = bug.backlog_url || null;
	const devinUrl = bug.devin_url || null;

	const actions = useBugActions({
		bug,
		onUpdate,
		onDelete,
		onPersistError,
		onReviewed,
	});

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (!files.length) return;
		e.target.value = "";
		await actions.uploadFiles(files);
	};

	const handlePaste = async (e: React.ClipboardEvent) => {
		const items = Array.from(e.clipboardData?.items || []);
		const imageFiles = items
			.filter((item) => item.type.startsWith("image/"))
			.map((item) => {
				const file = item.getAsFile();
				if (file) {
					const ext = file.type.split("/")[1] || "png";
					return new File([file], `pasted-image-${Date.now()}.${ext}`, {
						type: file.type,
					});
				}
				return null;
			})
			.filter((f): f is File => f !== null);
		if (imageFiles.length) {
			e.preventDefault();
			await actions.uploadFiles(imageFiles);
		}
	};

	const handleAddComment = async () => {
		await actions.addComment(commentText);
		setCommentText("");
		setShowCommentInput(false);
	};

	const startEditing = () => {
		setEditing(true);
		setExpanded(true);
	};

	const requestDelete = () => {
		if (isDeleting) return;
		setPendingDelete(true);
	};

	const cancelDelete = () => {
		if (isDeleting) return;
		setPendingDelete(false);
	};

	const confirmDelete = async () => {
		if (isDeleting) return;
		setIsDeleting(true);
		const deleted = await actions.deleteBug();
		if (deleted) return;
		setIsDeleting(false);
		setPendingDelete(false);
		onPersistError?.("Failed to delete bug.");
	};

	return (
		<div
			className={`group mb-2 rounded-lg border border-slate-200 dark:border-gray-700 transition-shadow hover:shadow-sm dark:hover:shadow-md dark:hover:shadow-black/20 ${bug.reviewed ? "bg-slate-50/60 dark:bg-gray-900/60 opacity-60" : "bg-white dark:bg-gray-900"} ${isDeleting ? "opacity-50" : ""}`}
			style={{
				borderLeft: `4px solid ${bug.reviewed ? "#94a3b8" : style.badge}`,
			}}
		>
			<div className="flex items-center">
				<button
					onClick={actions.toggleReviewed}
					className={`shrink-0 pl-4 pr-1 py-3 cursor-pointer transition-colors ${bug.reviewed ? "text-green-500" : "text-slate-300 dark:text-gray-600 hover:text-green-400"}`}
					title={bug.reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
				>
					<CheckCircle size={18} />
				</button>
				<button
					onClick={() => setExpanded(!expanded)}
					className="flex flex-1 items-center gap-2 sm:gap-3 px-2 py-3 text-left cursor-pointer min-w-0"
				>
					{expanded ? (
						<ChevronDown
							size={16}
							className="text-slate-400 dark:text-gray-500 shrink-0"
						/>
					) : (
						<ChevronRight
							size={16}
							className="text-slate-400 dark:text-gray-500 shrink-0"
						/>
					)}
					<span
						className={`text-xs font-bold text-slate-400 dark:text-gray-500 shrink-0 ${bug.reviewed ? "line-through" : ""}`}
						style={{ minWidth: 48 }}
					>
						{bug.id}
					</span>
					<div className="flex-1 min-w-0">
						<span
							className={`block truncate text-sm font-medium ${bug.reviewed ? "line-through text-slate-400 dark:text-gray-600" : "text-slate-900 dark:text-gray-100"}`}
						>
							{bug.title}
						</span>
						<span className="block text-[11px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">
							{bug.page}
							{bug.category ? ` \u00b7 ${bug.category}` : ""}
							{bug.device ? ` \u00b7 ${bug.device}` : ""}
						</span>
					</div>
					<div className="hidden sm:flex items-center gap-3 shrink-0 ml-3">
						{bug.attachments.length > 0 && (
							<span className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
								<Paperclip size={12} />
								{bug.attachments.length}
							</span>
						)}
						{bug.comments.length > 0 && (
							<span className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
								<MessageSquare size={12} />
								{bug.comments.length}
							</span>
						)}
						<TesterBadge>{bug.tester}</TesterBadge>
						<span
							role="button"
							tabIndex={0}
							onClick={(e) => {
								e.stopPropagation();
								startEditing();
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.stopPropagation();
									startEditing();
								}
							}}
							className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-all cursor-pointer"
							title="Edit bug"
						>
							<Pencil size={14} />
						</span>
						<span
							role="button"
							tabIndex={0}
							onClick={(e) => {
								e.stopPropagation();
								requestDelete();
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.stopPropagation();
									requestDelete();
								}
							}}
							className={`text-slate-400 dark:text-gray-500 transition-all ${pendingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${isDeleting ? "cursor-default" : "cursor-pointer hover:text-red-500 dark:hover:text-red-400"}`}
							title="Delete bug"
						>
							<Trash2 size={14} />
						</span>
						{pendingDelete && (
							<span
								className="flex items-center gap-1 text-[11px] font-semibold text-red-500 dark:text-red-400"
								onClick={(e) => e.stopPropagation()}
							>
								<span>Confirm?</span>
								{isDeleting ? (
									<span className="text-slate-400 dark:text-gray-500">
										Deleting...
									</span>
								) : (
									<>
										<span
											role="button"
											tabIndex={0}
											onClick={(e) => {
												e.stopPropagation();
												void confirmDelete();
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.stopPropagation();
													void confirmDelete();
												}
											}}
											className="rounded p-0.5 text-green-500 dark:text-green-400 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
											title="Confirm delete"
										>
											<Check size={12} />
										</span>
										<span
											role="button"
											tabIndex={0}
											onClick={(e) => {
												e.stopPropagation();
												cancelDelete();
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.stopPropagation();
													cancelDelete();
												}
											}}
											className="rounded p-0.5 text-red-500 dark:text-red-400 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
											title="Cancel delete"
										>
											<X size={12} />
										</span>
									</>
								)}
							</span>
						)}
						{backlogUrl && (
							<a
								href={backlogUrl}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(e) => e.stopPropagation()}
								className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
							>
								<ExternalLink size={10} />
								View in Backlog
							</a>
						)}
						{devinUrl && (
							<a
								href={devinUrl}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(e) => e.stopPropagation()}
								className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/50 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/70 transition-colors"
							>
								<Rocket size={10} />
								View Devin
							</a>
						)}
					</div>
					{/* Mobile: show tester name inline */}
					<span className="sm:hidden shrink-0 text-[11px] text-slate-400 dark:text-gray-500 ml-1 max-w-[80px] truncate">
						{bug.tester}
					</span>
				</button>
			</div>

			{expanded && (
				<div
					className="border-t border-slate-100 dark:border-gray-800 px-4 py-3"
					onPaste={handlePaste}
				>
					{editing ? (
						<BugEditForm
							initial={{
								title: bug.title,
								description: bug.description || "",
								severity: bug.severity,
								tester: bug.tester,
								device: bug.device,
								page: bug.page,
								category: bug.category || "",
							}}
							onSave={async (fields) => {
								const ok = await actions.saveBugEdit(fields);
								if (ok) setEditing(false);
								return ok;
							}}
							onCancel={() => setEditing(false)}
						/>
					) : (
						<p className="mb-3 text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
							{bug.description}
						</p>
					)}

					<div className="mb-3">
						{bug.attachments.length > 0 && (
							<p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">
								Attachments
							</p>
						)}
						<div className="flex flex-wrap gap-3">
							{bug.attachments.map((att, i) => (
								<AttachmentCard
									key={att.id || i}
									att={att}
									onImageClick={onImageClick}
									onRemove={() => actions.deleteAttachment(att, i)}
								/>
							))}
							<div
								className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 text-slate-400 dark:text-gray-500 text-[10px] text-center leading-tight px-2 cursor-default"
								style={{ width: 180, height: 140 }}
							>
								<span>
									Paste image
									<br />
									to attach
								</span>
							</div>
						</div>
					</div>

					{bug.comments.length > 0 && (
						<div className="mb-3">
							<p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">
								Comments
							</p>
							{bug.comments.map((c, i) => (
								<div
									key={c.id || i}
									className="group/comment mb-1.5 flex items-start gap-2 rounded-md bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-700 dark:text-gray-300"
								>
									<span className="flex-1">
										{c.text}
										{c.time && (
											<span className="ml-2 text-xs text-slate-400 dark:text-gray-500">
												({c.time})
											</span>
										)}
									</span>
									<button
										onClick={() => actions.deleteComment(c, i)}
										className="shrink-0 opacity-0 group-hover/comment:opacity-100 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity cursor-pointer"
										title="Delete comment"
									>
										<Trash2 size={13} />
									</button>
								</div>
							))}
						</div>
					)}

					<div className="flex flex-col sm:flex-row sm:items-center gap-2">
						<button
							onClick={() => fileRef.current?.click()}
							className="flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
						>
							<Paperclip size={12} />
							Attach
						</button>
						<input
							ref={fileRef}
							type="file"
							multiple
							accept="image/*,video/*"
							onChange={handleFileUpload}
							className="hidden"
						/>
						{showCommentInput ? (
							<div className="flex flex-1 items-center gap-2">
								<input
									value={commentText}
									onChange={(e) => setCommentText(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
									placeholder="Write a comment..."
									className="flex-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500"
									autoFocus
								/>
								<button
									onClick={handleAddComment}
									className="rounded-md bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors cursor-pointer"
								>
									Add
								</button>
							</div>
						) : (
							<button
								onClick={() => setShowCommentInput(true)}
								className="flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
							>
								<MessageSquare size={12} />
								Comment
							</button>
						)}
						<div className="hidden sm:block flex-1" />
						{backlogUrl && (
							<a
								href={backlogUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-1.5 rounded-md border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/40 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors"
							>
								<ExternalLink size={12} />
								View in Backlog
							</a>
						)}
						<PublishMenu
							publishing={publishing}
							publishingMode={publishingMode}
							backlogUrl={backlogUrl}
							onPublish={(withDevin) =>
								actions.publishToBacklog(withDevin, setPublishingMode, () => {})
							}
						/>
						<button
							onClick={requestDelete}
							disabled={isDeleting}
							className="flex items-center justify-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
						>
							<Trash2 size={12} />
							Delete Bug
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
