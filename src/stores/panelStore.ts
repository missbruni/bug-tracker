import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { playAiSound } from '../lib/audio'

interface UIState {
  settingsOpen: boolean
  aiPanelOpen: boolean
  isDark: boolean
  openSettings: () => void
  closeSettings: () => void
  toggleAiPanel: () => void
  closeAiPanel: () => void
  setDark: (dark: boolean) => void
}

export const usePanelStore = create<UIState>()(
  subscribeWithSelector((set) => ({
    settingsOpen: false,
    aiPanelOpen: sessionStorage.getItem('aiPanelOpen') === 'true',
    isDark: typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),

    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),
    toggleAiPanel: () =>
      set((s) => {
        playAiSound(!s.aiPanelOpen)
        return { aiPanelOpen: !s.aiPanelOpen }
      }),
    closeAiPanel: () => set({ aiPanelOpen: false }),
    setDark: (dark) => set({ isDark: dark }),
  })),
)

// Persist AI panel state to sessionStorage
usePanelStore.subscribe(
  (s) => s.aiPanelOpen,
  (open) => sessionStorage.setItem('aiPanelOpen', String(open)),
)
