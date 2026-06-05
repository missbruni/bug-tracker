import React from 'react'
import { usePanelStore } from '../stores/panelStore'
import AnnouncementBanner from './AnnouncementBanner'

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
    <AnnouncementBanner
      title="New: AI Assistant"
      titleClassName="font-bold"
      titleStyle={{ fontFamily: "'Press Start 2P', 'Courier New', monospace", fontSize: '10px' }}
      actions={[{ label: 'Try now', onClick: openAi }]}
      onDismiss={dismiss}
    >
      — Log bugs by chatting, manage sessions, and get help with your testing workflow.
    </AnnouncementBanner>
  )
}
