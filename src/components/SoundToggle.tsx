import React from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isAudioMuted, toggleAudioMuted, playToggleSound } from '../lib/audio'

export default function SoundToggle() {
  const [muted, setMuted] = React.useState(isAudioMuted)

  return (
    <button
      onClick={() => {
        const nowMuted = toggleAudioMuted()
        setMuted(nowMuted)
        if (!nowMuted) playToggleSound(false)
      }}
      className="relative rounded-lg p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer overflow-hidden"
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      style={{ width: 34, height: 34 }}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  )
}
