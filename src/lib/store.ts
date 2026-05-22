import { create } from 'zustand'
import type { BugFiltersActionPayload } from './aiTypes'

// ─── UI Store ───
// Manages global UI panels and theme state, replacing
// openAiAssistant, openSettings, and themechange custom events.

interface UIState {
  aiPanelOpen: boolean
  settingsOpen: boolean
  isDark: boolean
  toggleAiPanel: () => void
  openAiPanel: () => void
  closeAiPanel: () => void
  openSettings: () => void
  closeSettings: () => void
  setIsDark: (dark: boolean) => void
}

const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null
const initialDark = storedTheme ? storedTheme === 'dark' : true

export const useUIStore = create<UIState>((set) => ({
  aiPanelOpen: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('aiPanelOpen') === 'true',
  settingsOpen: false,
  isDark: initialDark,
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  openAiPanel: () => set({ aiPanelOpen: true }),
  closeAiPanel: () => set({ aiPanelOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setIsDark: (dark) => set({ isDark: dark }),
}))

// ─── Bug Filters Store ───
// Replaces setBugFiltersFromAi custom event.
// AI assistant calls setFiltersFromAi(), useBugFilters subscribes.

interface BugFiltersState {
  /** Increments on each AI filter update so subscribers can react */
  version: number
  payload: BugFiltersActionPayload | null
  setFiltersFromAi: (payload: BugFiltersActionPayload) => void
}

export const useBugFiltersStore = create<BugFiltersState>((set) => ({
  version: 0,
  payload: null,
  setFiltersFromAi: (payload) => set((s) => ({ payload, version: s.version + 1 })),
}))

// ─── Session Events Store ───
// Replaces sessionDataChanged and sessionDeleted custom events.

interface SessionEventsState {
  /** Increments when AI modifies session data */
  dataChangedVersion: number
  dataChangedSessionId: string | null
  /** Increments when AI deletes a session */
  deletedVersion: number
  deletedSessionId: string | null
  notifySessionDataChanged: (sessionId: string) => void
  notifySessionDeleted: (sessionId: string) => void
}

export const useSessionEventsStore = create<SessionEventsState>((set) => ({
  dataChangedVersion: 0,
  dataChangedSessionId: null,
  deletedVersion: 0,
  deletedSessionId: null,
  notifySessionDataChanged: (sessionId) =>
    set((s) => ({ dataChangedVersion: s.dataChangedVersion + 1, dataChangedSessionId: sessionId })),
  notifySessionDeleted: (sessionId) =>
    set((s) => ({ deletedVersion: s.deletedVersion + 1, deletedSessionId: sessionId })),
}))

// ─── Team Events Store ───
// Replaces teamDataChanged custom event.

interface TeamEventsState {
  version: number
  notifyTeamDataChanged: () => void
}

export const useTeamEventsStore = create<TeamEventsState>((set) => ({
  version: 0,
  notifyTeamDataChanged: () => set((s) => ({ version: s.version + 1 })),
}))
