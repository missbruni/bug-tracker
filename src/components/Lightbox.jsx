import { X } from 'lucide-react'

export default function Lightbox({ src, alt, type, onClose }) {
  const isVideo = type === 'video' || src?.match(/\.(mp4|webm|mov|ogg)$/i)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
      >
        <X size={20} />
      </button>
      {isVideo ? (
        <video
          src={src}
          controls
          autoPlay
          className="max-h-full max-w-full rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}
