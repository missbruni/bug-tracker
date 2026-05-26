import React from 'react'
import { Megaphone, X } from 'lucide-react'
import { usePanelStore } from '../stores/panelStore'

const DISMISSED_KEY = 'ai-banner-dismissed'

export default function AiBanner() {
  const [dismissed, setDismissed] = React.useState(() => localStorage.getItem(DISMISSED_KEY) === 'true')

  if (dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  const openAi = () => {
    usePanelStore.getState().toggleAiPanel()
    dismiss()
  }

  return (
    <div className="relative overflow-hidden border-b border-blue-200 dark:border-mushi-primary/30 bg-blue-50/80 dark:bg-mushi-primary/5">
      {/* Animated shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/40 dark:via-mushi-primary/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      <div className="relative max-w-screen-2xl mx-auto px-7 py-2.5 flex items-center gap-3">
        <Megaphone size={16} className="text-blue-500 dark:text-mushi-primary shrink-0 animate-[announce_2s_ease-in-out_infinite]" />
        <p className="flex-1 text-xs text-blue-800 dark:text-mushi-primary/80">
          <span className="font-bold" style={{ fontFamily: "'Press Start 2P', 'Courier New', monospace", fontSize: '10px' }}>New: AI Assistant</span> — Log bugs by chatting, manage sessions, and get help with your testing workflow.
        </p>
        <button
          onClick={openAi}
          className="rounded-md bg-blue-500 dark:bg-mushi-primary hover:bg-blue-600 dark:hover:bg-mushi-primary/80 px-3 py-1 text-xs font-bold text-white dark:text-mushi-bg transition-colors cursor-pointer whitespace-nowrap animate-[bounce-subtle_1.5s_ease-in-out_infinite]"
        >
          Try now
        </button>
        <button
          onClick={dismiss}
          className="text-blue-300 dark:text-mushi-accent hover:text-blue-600 dark:hover:text-mushi-accent/80 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
