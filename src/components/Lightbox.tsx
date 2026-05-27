import React from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface LightboxItem {
  src: string
  alt: string
  type: string
}

interface LightboxProps {
  items: LightboxItem[]
  currentIndex: number
  onClose: () => void
}

export default function Lightbox({ items, currentIndex, onClose }: LightboxProps) {
  const [index, setIndex] = React.useState(currentIndex)
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1
  const showNav = items.length > 1

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrev) setIndex(prev => prev - 1)
      else if (event.key === 'ArrowRight' && hasNext) setIndex(prev => prev + 1)
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasPrev, hasNext, onClose])

  if (!item) return null

  const isVideo = item.type === 'video' || item.src?.match(/\.(mp4|webm|mov|ogg)$/i)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors cursor-pointer"
      >
        <X size={20} />
      </button>

      {showNav && hasPrev && (
        <button
          onClick={(event) => { event.stopPropagation(); setIndex(prev => prev - 1) }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {showNav && hasNext && (
        <button
          onClick={(event) => { event.stopPropagation(); setIndex(prev => prev + 1) }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors cursor-pointer"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {isVideo ? (
        <video
          src={item.src}
          controls
          autoPlay
          className="max-h-full max-w-full rounded-lg"
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img
          src={item.src}
          alt={item.alt}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      )}

      {showNav && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  )
}
