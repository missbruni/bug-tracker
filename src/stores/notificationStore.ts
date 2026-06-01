import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { BugFiltersActionPayload } from '../lib/useAiAssistant'

interface AppEventState {
  sessionDataChanged: { sessionId: string; version: number }
  sessionDeleted: { sessionId: string; version: number }
  teamDataChanged: { version: number }
  bugFiltersCommand: { payload: BugFiltersActionPayload | null; version: number }

  notifySessionDataChanged: (sessionId: string) => void
  notifySessionDeleted: (sessionId: string) => void
  notifyTeamDataChanged: () => void
  applyBugFilters: (payload: BugFiltersActionPayload) => void
}

export const useNotificationStore = create<AppEventState>()(
  subscribeWithSelector((set) => ({
    sessionDataChanged: { sessionId: '', version: 0 },
    sessionDeleted: { sessionId: '', version: 0 },
    teamDataChanged: { version: 0 },
    bugFiltersCommand: { payload: null, version: 0 },

    notifySessionDataChanged: (sessionId) =>
      set((s) => ({
        sessionDataChanged: { sessionId, version: s.sessionDataChanged.version + 1 },
      })),
    notifySessionDeleted: (sessionId) =>
      set((s) => ({
        sessionDeleted: { sessionId, version: s.sessionDeleted.version + 1 },
      })),
    notifyTeamDataChanged: () =>
      set((s) => ({
        teamDataChanged: { version: s.teamDataChanged.version + 1 },
      })),
    applyBugFilters: (payload) =>
      set((s) => ({
        bugFiltersCommand: { payload, version: s.bugFiltersCommand.version + 1 },
      })),
  })),
)
