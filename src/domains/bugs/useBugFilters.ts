import React from "react";
import { SEVERITIES } from "../../constants";
import { matchesDateFilter } from "./dateFilter";
import type { Bug, Question } from "./model";
import type { SessionOption } from "../../domains/sessions/model";
import type { Severity } from "../../constants";
import { useNotificationStore } from "../../stores/notificationStore";

const VALID_SEVERITY_FILTERS = new Set([
	"all",
	"critical",
	"high",
	"low",
	"completed",
]);
const ACTIVE_SEVERITY_FILTERS = ["critical", "high", "low"] as const;
const ACTIVE_SEVERITY_FILTER_SET = new Set<string>(ACTIVE_SEVERITY_FILTERS);
const VALID_DATE_FILTERS = new Set(["all", "today", "yesterday", "7d", "30d"]);
const VALID_SORT_FILTERS = new Set(["default", "newest", "oldest"]);

function parseSeverityTokens(value?: string | string[]): string[] {
	if (!value) return [];

	const values = Array.isArray(value) ? value : [value];
	return values.flatMap((entry) => {
		const normalized = entry.toLowerCase();
		const keywordMatches = normalized.match(
			/\b(all|active|completed|critical|high|low)\b/g,
		);
		if (keywordMatches?.length) {
			return keywordMatches.map((token) =>
				token === "active" ? "all" : token,
			);
		}

		return normalized
			.split(/,|\band\b|\bor\b|\/|&|\+/g)
			.map((token) => token.trim())
			.filter(Boolean)
			.map((token) => (token === "active" ? "all" : token));
	});
}

function normalizeSeverityFilterValue(tokens: string[]): string | null {
	const uniqueValidTokens = new Set(
		tokens.filter((token) => VALID_SEVERITY_FILTERS.has(token)),
	);
	if (!uniqueValidTokens.size) return null;

	if (uniqueValidTokens.has("all")) return "all";
	if (uniqueValidTokens.has("completed")) return "completed";

	const activeSelections = ACTIVE_SEVERITY_FILTERS.filter((token) =>
		uniqueValidTokens.has(token),
	);
	if (!activeSelections.length) return null;
	return activeSelections.join(",");
}

function getSelectedActiveSeverities(severityFilter: string): Set<string> {
	return new Set(
		severityFilter
			.split(",")
			.map((token) => token.trim().toLowerCase())
			.filter((token) => ACTIVE_SEVERITY_FILTER_SET.has(token)),
	);
}

function getParam(key: string): string {
	return new URLSearchParams(window.location.search).get(key) || "";
}

interface UseBugFiltersReturn {
	severityFilter: string;
	setSeverityFilter: (v: string) => void;
	search: string;
	setSearch: (v: string) => void;
	testerFilter: string;
	setTesterFilter: (v: string) => void;
	dateFilter: string;
	setDateFilter: (v: string) => void;
	sortOrder: string;
	setSortOrder: (v: string) => void;
	sessionFilter: string;
	setSessionFilter: (v: string) => void;
	testers: string[];
	filtered: Bug[];
	activeBugs: Bug[];
	counts: Record<Severity, number>;
	nextIds: Record<Severity, number>;
	grouped: Record<string, Bug[]>;
	filteredQuestions: Question[];
	isSearchPending: boolean;
}

export function useBugFilters(
	bugs: Bug[],
	questions: Question[],
	sessions: SessionOption[] = [],
): UseBugFiltersReturn {
	const [severityFilter, setSeverityFilter] = React.useState(() => {
		const severityFromUrl = getParam("severity");
		if (!severityFromUrl) return "all";

		return (
			normalizeSeverityFilterValue(parseSeverityTokens(severityFromUrl)) ||
			"all"
		);
	});
	const [search, setSearch] = React.useState(() => getParam("q") || "");
	const deferredSearch = React.useDeferredValue(search);
	const [testerFilter, setTesterFilter] = React.useState(
		() => getParam("tester") || "all",
	);
	const [dateFilter, setDateFilter] = React.useState(
		() => getParam("date") || "all",
	);
	const [sortOrder, setSortOrder] = React.useState(
		() => getParam("sort") || "default",
	);
	const [sessionFilter, setSessionFilter] = React.useState(
		() => getParam("session") || "all",
	);

	// Sync filters to URL
	React.useEffect(() => {
		const p = new URLSearchParams();
		if (search) p.set("q", search);
		if (severityFilter !== "all") p.set("severity", severityFilter);
		if (testerFilter !== "all") p.set("tester", testerFilter);
		if (dateFilter !== "all") p.set("date", dateFilter);
		if (sortOrder !== "default") p.set("sort", sortOrder);
		if (sessionFilter !== "all") p.set("session", sessionFilter);
		const qs = p.toString();
		window.history.replaceState(
			null,
			"",
			qs ? `?${qs}` : window.location.pathname,
		);
	}, [
		search,
		severityFilter,
		testerFilter,
		dateFilter,
		sortOrder,
		sessionFilter,
	]);

	const testers = [
		...new Set(bugs.flatMap((b) => b.tester.split(", "))),
	].sort();

	React.useEffect(() => {
		return useNotificationStore.subscribe(
			(s) => s.bugFiltersCommand.version,
			() => {
				const payload =
					useNotificationStore.getState().bugFiltersCommand.payload;
				if (!payload) return;

				if (payload.clear) {
					setSeverityFilter("all");
					setTesterFilter("all");
					setDateFilter("all");
					setSessionFilter("all");
					setSortOrder("default");
					setSearch("");
				}

				if (payload.search !== undefined) {
					setSearch(payload.search.trim());
				}

				const severityValue = normalizeSeverityFilterValue([
					...parseSeverityTokens(payload.severity),
					...parseSeverityTokens(payload.severities),
				]);
				if (severityValue) {
					setSeverityFilter(severityValue);
				}

				if (payload.tester) {
					const testerValue = payload.tester.trim();
					if (testerValue.toLowerCase() === "all") {
						setTesterFilter("all");
					} else {
						const matchedTester = testers.find(
							(testerName) =>
								testerName.toLowerCase() === testerValue.toLowerCase(),
						);
						if (matchedTester) {
							setTesterFilter(matchedTester);
						}
					}
				}

				if (payload.date) {
					const date = payload.date.trim().toLowerCase();
					if (VALID_DATE_FILTERS.has(date)) {
						setDateFilter(date);
					}
				}

				if (payload.sort) {
					const sort = payload.sort.trim().toLowerCase();
					if (VALID_SORT_FILTERS.has(sort)) {
						setSortOrder(sort);
					}
				}

				if (payload.session) {
					const sessionValue = payload.session.trim();
					const normalized = sessionValue.toLowerCase();
					if (normalized === "all" || normalized === "none") {
						setSessionFilter(normalized);
					} else {
						const matchedSession =
							sessions.find((s) => s.id === sessionValue) ||
							sessions.find((s) => s.name.toLowerCase() === normalized);
						if (matchedSession) {
							setSessionFilter(matchedSession.id);
						}
					}
				}
			},
		);
	}, [sessions, testers]);

	const filtered = (() => {
		const selectedActiveSeverities =
			getSelectedActiveSeverities(severityFilter);

		return bugs
			.filter((bug) => {
				if (severityFilter === "completed") {
					if (!bug.reviewed) return false;
				} else {
					if (bug.reviewed) return false;
				}
				if (selectedActiveSeverities.size > 0) {
					if (!selectedActiveSeverities.has(bug.severity)) return false;
				} else if (
					severityFilter !== "all" &&
					severityFilter !== "completed" &&
					bug.severity !== severityFilter
				)
					return false;
				if (testerFilter !== "all" && !bug.tester.includes(testerFilter))
					return false;
				if (sessionFilter !== "all") {
					const bugSessionId = bug.session_id;
					if (sessionFilter === "none") {
						if (bugSessionId) return false;
					} else if (bugSessionId !== sessionFilter) return false;
				}
				if (deferredSearch) {
					const query = deferredSearch.toLowerCase();
					if (
						!bug.title.toLowerCase().includes(query) &&
						!(bug.description || "").toLowerCase().includes(query) &&
						!bug.id.toLowerCase().includes(query) &&
						!bug.tester.toLowerCase().includes(query) &&
						!bug.device.toLowerCase().includes(query) &&
						!(bug.category || "").toLowerCase().includes(query) &&
						!bug.page.toLowerCase().includes(query)
					)
						return false;
				}
				if (!matchesDateFilter(bug.created_at, dateFilter)) return false;
				return true;
			})
			.sort((firstBug, secondBug) => {
				if (sortOrder === "newest")
					return (
						new Date(secondBug.created_at || 0).getTime() -
						new Date(firstBug.created_at || 0).getTime()
					);
				if (sortOrder === "oldest")
					return (
						new Date(firstBug.created_at || 0).getTime() -
						new Date(secondBug.created_at || 0).getTime()
					);
				return 0;
			});
	})();

	const activeBugs = bugs.filter((bug) => !bug.reviewed);

	const counts = (() => {
		const countsBySeverity: Record<Severity, number> = {
			critical: 0,
			high: 0,
			low: 0,
		};
		activeBugs.forEach((bug) => countsBySeverity[bug.severity]++);
		return countsBySeverity;
	})();

	const nextIds = {
		critical:
			Math.max(
				0,
				...bugs
					.filter((bug) => bug.severity === "critical")
					.map((bug) => parseInt(bug.id.replace(/\D+/g, "")) || 0),
			) + 1,
		high:
			Math.max(
				0,
				...bugs
					.filter((bug) => bug.severity === "high")
					.map((bug) => parseInt(bug.id.replace(/\D+/g, "")) || 0),
			) + 1,
		low:
			Math.max(
				0,
				...bugs
					.filter((bug) => bug.severity === "low")
					.map((bug) => parseInt(bug.id.replace(/\D+/g, "")) || 0),
			) + 1,
	};

	const grouped = (() => {
		const groupedBugs: Record<string, Bug[]> = {};
		SEVERITIES.forEach((severity) => {
			groupedBugs[severity] = filtered.filter(
				(bug) => bug.severity === severity,
			);
		});
		return groupedBugs;
	})();

	const filteredQuestions = questions.filter((question) =>
		matchesDateFilter(question.created_at, dateFilter),
	);

	return {
		severityFilter,
		setSeverityFilter,
		search,
		setSearch,
		testerFilter,
		setTesterFilter,
		dateFilter,
		setDateFilter,
		sortOrder,
		setSortOrder,
		sessionFilter,
		setSessionFilter,
		testers,
		filtered,
		activeBugs,
		counts,
		nextIds,
		grouped,
		filteredQuestions,
		isSearchPending: search !== deferredSearch,
	};
}
