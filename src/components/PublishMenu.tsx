import React from 'react'
import { ChevronDown, ExternalLink, Rocket } from 'lucide-react'
import { hasDevinApiKey, openSettings } from '../lib/devin'

interface PublishMenuProps {
  publishing: boolean
  publishingMode: 'backlog' | 'devin' | null
  backlogUrl: string | null
  onPublish: (withDevin: boolean) => void
}

export default function PublishMenu({ publishing, publishingMode, backlogUrl, onPublish }: PublishMenuProps) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [devinKeyMissing, setDevinKeyMissing] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const splitRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setDevinKeyMissing(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="relative w-full sm:w-auto" ref={menuRef}>
      <div className="flex w-full" ref={splitRef}>
        <button
          onClick={() => onPublish(false)}
          disabled={publishing}
          className={`flex flex-1 items-center justify-center gap-1.5 border border-r-0 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50 ${menuOpen ? 'rounded-tl-md' : 'rounded-l-md'}`}
        >
          <ExternalLink size={12} />
          {publishingMode === 'devin' ? 'Publishing + Devin...' : publishing ? 'Publishing...' : backlogUrl ? 'Re-publish' : 'Publish to Backlog'}
        </button>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          disabled={publishing}
          className={`flex items-center border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/40 px-2 py-1.5 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50 ${menuOpen ? 'rounded-tr-md' : 'rounded-r-md'}`}
          title="More publish options"
          aria-label="More publish options"
        >
          <ChevronDown size={12} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {menuOpen && !publishing && (
        <div
          className="absolute left-0 top-full z-20"
          style={{ width: Math.max(splitRef.current?.offsetWidth || 0, devinKeyMissing ? 260 : 0) }}
        >
          <button
            onClick={() => {
              if (!hasDevinApiKey()) {
                setDevinKeyMissing(true)
                return
              }
              setDevinKeyMissing(false)
              setMenuOpen(false)
              onPublish(true)
            }}
            className="w-full flex items-center gap-1.5 border border-t-0 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
            style={{ borderRadius: devinKeyMissing ? 0 : '0 0 6px 6px' }}
          >
            <Rocket size={12} />
            Publish + Devin
          </button>
          {devinKeyMissing && (
            <div className="rounded-b-md border border-t-0 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Configure your Devin API key first.{' '}
              <button
                onClick={() => { setMenuOpen(false); setDevinKeyMissing(false); openSettings() }}
                className="underline font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
              >
                Open Settings
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
