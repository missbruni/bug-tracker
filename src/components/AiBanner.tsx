import { useState } from 'react'
import { Megaphone, X } from 'lucide-react'

const DISMISSED_KEY = 'ai-banner-dismissed'

export default function AiBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true')

  if (dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  const openAi = () => {
    window.dispatchEvent(new CustomEvent('openAiAssistant'))
    dismiss()
  }

  return (
    <div className="relative overflow-hidden border-b border-indigo-200 dark:border-amber-800/50 bg-indigo-50/80 dark:bg-amber-900/20">
      {/* Animated shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-200/40 dark:via-amber-500/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      <div className="relative max-w-screen-2xl mx-auto px-7 py-2.5 flex items-center gap-3">
        <Megaphone size={16} className="text-indigo-500 dark:text-amber-400 shrink-0 animate-[announce_2s_ease-in-out_infinite]" />
        <p className="flex-1 text-xs text-indigo-800 dark:text-amber-300">
          <span className="font-bold" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '10px' }}>New: AI Assistant</span> — Log bugs by chatting, manage sessions, and get help with your testing workflow.
        </p>
        <button
          onClick={openAi}
          className="rounded-md bg-indigo-500 dark:bg-amber-500 hover:bg-indigo-600 dark:hover:bg-amber-600 px-3 py-1 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap animate-[bounce-subtle_1.5s_ease-in-out_infinite]"
        >
          Try now
        </button>
        <button
          onClick={dismiss}
          className="text-indigo-300 dark:text-amber-700 hover:text-indigo-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
