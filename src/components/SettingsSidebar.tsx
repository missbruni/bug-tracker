import { useState, useEffect } from 'react'
import { X, Settings, Eye, EyeOff, ExternalLink, Check } from 'lucide-react'
import { getDevinApiKey, setDevinApiKey, removeDevinApiKey, isValidDevinKey } from '../lib/devin'

interface SettingsSidebarProps {
  open: boolean
  onClose: () => void
}

export default function SettingsSidebar({ open, onClose }: SettingsSidebarProps) {
  const [devinKey, setDevinKey] = useState(() => getDevinApiKey())
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState('')

  useEffect(() => {
    if (open) setDevinKey(getDevinApiKey())
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const save = () => {
    if (!devinKey.trim()) return
    if (!isValidDevinKey(devinKey)) {
      setKeyError('Key must start with apk_user. Check your Devin dashboard for a valid API key.')
      return
    }
    setKeyError('')
    setDevinApiKey(devinKey)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1200)
  }

  const clear = () => {
    setDevinKey('')
    removeDevinApiKey()
    setSaved(false)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-white dark:bg-gray-900 border-l border-slate-200 dark:border-gray-800 shadow-xl transform transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Settings size={16} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 overflow-y-auto h-[calc(100%-57px)]">
          {/* Devin Section */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-3">
              Devin Integration
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mb-3 leading-relaxed">
              Add your Devin API key (PAT) to enable the <strong>Publish + Devin</strong> feature.
              This key is stored locally in your browser and never sent to our servers.
            </p>

            <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5">
              Devin API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={devinKey}
                onChange={(e) => { setDevinKey(e.target.value); setSaved(false); setKeyError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') save() }}
                placeholder="apk_user_xxxxxxxx"
                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 px-3 py-2 pr-9 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {keyError && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{keyError}</p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={save}
                disabled={!devinKey.trim()}
                className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                  saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {saved ? (
                  <>
                    <Check size={14} className="animate-scaleIn" />
                    Saved
                  </>
                ) : 'Save'}
              </button>
              {getDevinApiKey() && (
                <button
                  onClick={clear}
                  className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            <a
              href="https://docs.devin.ai/api-reference/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-blue-500 dark:text-blue-400 hover:underline"
            >
              <ExternalLink size={10} />
              How to get your Devin API key
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
