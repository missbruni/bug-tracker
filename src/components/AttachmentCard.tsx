import { Paperclip, Play, X } from 'lucide-react'

export interface Attachment {
  id?: number
  bug_id?: string
  name: string
  url: string
  type: string
  file?: File
  note?: string
}

interface AttachmentCardProps {
  att: Attachment
  onRemove?: () => void
  onImageClick?: (url: string, name: string, type: string) => void
}

export default function AttachmentCard({ att, onRemove, onImageClick }: AttachmentCardProps) {
  const isImage = att.type?.startsWith('image/') || att.name?.match(/\.(png|jpe?g|gif|webp|svg)$/i)
  const isVideo = att.type?.startsWith('video/') || att.name?.match(/\.(mp4|webm|mov|ogg)$/i)
  const hasPreview = (isImage || isVideo) && att.url

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs shadow-sm" style={{ width: 180 }}>
      {hasPreview ? (
        <button
          onClick={() => onImageClick?.(att.url, att.name, isVideo ? 'video' : 'image')}
          className="relative block h-28 w-full cursor-pointer overflow-hidden bg-slate-100 dark:bg-gray-900"
        >
          {isVideo ? (
            <>
              <video src={att.url} className="h-full w-full object-cover" muted preload="metadata" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play size={28} className="text-white drop-shadow" fill="white" />
              </div>
            </>
          ) : (
            <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
          )}
        </button>
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-slate-50 dark:bg-gray-900">
          <Paperclip size={24} className="text-slate-300 dark:text-gray-600" />
        </div>
      )}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="flex-1 truncate text-slate-700 dark:text-gray-300" title={att.name}>{att.name}</span>
        {onRemove && (
          <button onClick={onRemove} className="shrink-0 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer">
            <X size={12} />
          </button>
        )}
      </div>
      {att.note && <p className="px-2 pb-1.5 text-[10px] text-slate-400 dark:text-gray-500 leading-tight truncate" title={att.note}>{att.note}</p>}
    </div>
  )
}
