import React from 'react'

interface BottomSheetProps {
  onClose: () => void
  children: React.ReactNode
  /** Extra classes on the fixed overlay root (e.g. "z-[60]" to override stacking). */
  className?: string
}

export default function BottomSheet({ onClose, children, className }: BottomSheetProps) {
  const [closing, setClosing] = React.useState(false)

  const handleClose = React.useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [closing, onClose])

  return (
    <div className={`fixed inset-0 z-50 ${className ?? ''}`}>
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'} bg-black/40`}
        onClick={handleClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[85vh] overflow-y-auto"
        style={{ animation: `${closing ? 'slideDown' : 'slideUp'} 0.25s ease-out forwards` }}
      >
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 bg-white dark:bg-gray-900 rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-gray-600" />
        </div>
        <div className="px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}
