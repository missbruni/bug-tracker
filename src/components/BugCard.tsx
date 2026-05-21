import React from "react"
import {
	ChevronDown,
	ChevronRight,
	Paperclip,
	MessageSquare,
	Trash2,
	CheckCircle,
	ExternalLink,
	Rocket,
	Pencil,
	Link,
	Check,
} from "lucide-react";
import { SEVERITY_STYLES } from "../constants";
import { TesterBadge } from "./TesterBadge";
import AttachmentCard from "./AttachmentCard";
import BugEditForm from "./BugEditForm";
import PublishMenu from "./PublishMenu";
import { useBugActions } from "../hooks/useBugActions";
import InlineDeleteConfirm from "./InlineDeleteConfirm";
import { buildBugPermalink, copyToClipboard } from "../lib/bugPermalink";
import type { Bug } from "../types";

interface BugCardProps {
	bug: Bug;
	onUpdate: (bug: Bug) => void;
	onImageClick: (src: string, alt: string, type: string) => void;
	onDelete: (bugId: string) => void;
	onDeleteWithUndo?: (bug: Bug, hardDelete: () => Promise<boolean>) => void;
	onPersistError?: (message: string) => void;
	onReviewed?: (bug: Bug, undo: () => void, message?: string) => void;
	onLinkCopied?: (bugId: string) => void;
}

export default function BugCard({
	bug,
	onUpdate,
	onImageClick,
	onDelete,
	onDeleteWithUndo,
	onPersistError,
	onReviewed,
	onLinkCopied,
}: BugCardProps) {
	const [expanded, setExpanded] = React.useState(false);
	const [pendingDelete, setPendingDelete] = React.useState(false);
	const [isDeleting] = React.useState(false);
	const [commentText, setCommentText] = React.useState("");
	const [showCommentInput, setShowCommentInput] = React.useState(false);
	const [publishingMode, setPublishingMode] = React.useState<
		"backlog" | "devin" | null
	>(null);
	const [editing, setEditing] = React.useState(false);
	const [linkCopied, setLinkCopied] = React.useState(false);
	const publishing = publishingMode !== null;
	const fileRef = React.useRef<HTMLInputElement>(null);
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

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || []);
		if (!files.length) return;
		event.target.value = "";
		await actions.uploadFiles(files);
	};

	const handlePaste = async (event: React.ClipboardEvent) => {
		const items = Array.from(event.clipboardData?.items || []);
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
			event.preventDefault();
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

	const confirmDelete = () => {
		if (isDeleting) return;
		actions.softDeleteBug();
		if (onDeleteWithUndo) {
			onDeleteWithUndo(bug, actions.hardDeleteBug);
		}
	};

	const handleCopyLink = async (event: React.MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();
		const url = buildBugPermalink(bug.id);
		const ok = await copyToClipboard(url);
		if (ok) {
			setLinkCopied(true);
			setTimeout(() => setLinkCopied(false), 1500);
			onLinkCopied?.(bug.id);
		}
	};

	return (
		<div
			className={`card group mb-2 rounded-lg transition-shadow hover:shadow-xs dark:hover:shadow-md dark:hover:shadow-black/20 ${bug.reviewed ? "bg-slate-50/60! dark:bg-gray-900/60! opacity-60" : ""} ${isDeleting ? "opacity-50" : ""}`}
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
						className={`text-xs font-bold font-heading text-slate-400 dark:text-gray-500 shrink-0 ${bug.reviewed ? "line-through" : ""}`}
						style={{ minWidth: 48 }}
					>
						{bug.id}
					</span>
					<div className="flex-1 min-w-0">
						<span
							className={`block truncate text-sm font-medium font-heading ${bug.reviewed ? "line-through text-slate-400 dark:text-gray-600" : "text-slate-900 dark:text-gray-100"}`}
						>
							{bug.title}
						</span>
						<span className="block text-[11px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">
							{bug.page}
							{bug.category ? ` \u00b7 ${bug.category}` : ""}
							{bug.device ? ` \u00b7 ${bug.device}` : ""}
						</span>
					</div>
					<div className="hidden md:flex items-center gap-3 shrink-0 ml-3">
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
							onClick={handleCopyLink}
							onKeyDown={(event) => {
								if (event.key === "Enter") void handleCopyLink(event as unknown as React.MouseEvent);
							}}
							className={`transition-all cursor-pointer ${linkCopied ? "opacity-100 text-green-500 dark:text-green-400" : "opacity-0 group-hover:opacity-100 text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"}`}
							title="Copy link to bug"
						>
							{linkCopied ? <Check size={14} /> : <Link size={14} />}
						</span>
						{backlogUrl && (
							<a
								href={backlogUrl}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(event) => event.stopPropagation()}
								className="badge badge-green hover:brightness-110"
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
								onClick={(event) => event.stopPropagation()}
								className="badge badge-purple hover:brightness-110"
							>
								<Rocket size={10} />
								View Devin
							</a>
						)}
						<span
							role="button"
							tabIndex={0}
							onClick={(event) => {
								event.stopPropagation();
								startEditing();
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.stopPropagation();
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
							onClick={(event) => {
								event.stopPropagation();
								requestDelete();
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.stopPropagation();
									requestDelete();
								}
							}}
							className={`text-slate-400 dark:text-gray-500 transition-all ${pendingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${isDeleting ? "cursor-default" : "cursor-pointer hover:text-red-500 dark:hover:text-red-400"}`}
							title="Delete bug"
						>
							<Trash2 size={14} />
						</span>
						{pendingDelete && !expanded && (
							<InlineDeleteConfirm
								isDeleting={isDeleting}
								onConfirm={() => void confirmDelete()}
								onCancel={cancelDelete}
							/>
						)}
					</div>
					{/* Mobile: show tester name inline */}
					<span className="md:hidden shrink-0 text-[11px] text-slate-400 dark:text-gray-500 ml-1 max-w-[80px] truncate">
						{bug.tester}
					</span>
				</button>
			</div>

			<div className={`collapse-grid ${expanded ? 'open' : ''}`}>
			<div>
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
									onChange={(event) => setCommentText(event.target.value)}
									onKeyDown={(event) => event.key === "Enter" && handleAddComment()}
									placeholder="Write a comment..."
									className="flex-1 rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500"
									autoFocus
								/>
								<button
									onClick={handleAddComment}
									className="rounded-md bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer"
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
						<div className="hidden md:block flex-1" />
						<button
							onClick={handleCopyLink}
							className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors cursor-pointer ${linkCopied ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400" : "border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"}`}
						>
							{linkCopied ? <Check size={12} /> : <Link size={12} />}
							{linkCopied ? "Copied!" : "Copy Link"}
						</button>
						{backlogUrl && (
							<a
								href={backlogUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="badge badge-green hover:brightness-110 px-3 py-1.5 text-xs"
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
						{pendingDelete && expanded ? (
							<InlineDeleteConfirm
								isDeleting={isDeleting}
								onConfirm={() => void confirmDelete()}
								onCancel={cancelDelete}
							/>
						) : (
							<button
								onClick={requestDelete}
								className="flex items-center justify-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
							>
								<Trash2 size={12} />
								Delete Bug
							</button>
						)}
					</div>
				</div>
			</div>
			</div>
		</div>
	);
}
