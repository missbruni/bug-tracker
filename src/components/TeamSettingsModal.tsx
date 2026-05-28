import React from 'react'
import { X, Settings, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { TeamRecord } from '../lib/teamScope'
import type { Product } from './TeamCard'

interface TeamSettingsModalProps {
  team: TeamRecord
  products: Product[]
  onClose: () => void
  onSaved: (updates: { timezone: string | null; default_product_id: string | null }) => void
}

type Toast = { message: string; tone: 'success' | 'error' }

function getSupportedTimezones(): string[] {
  type IntlWithSupportedValues = typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  const intl = Intl as IntlWithSupportedValues
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone')
    } catch {
      // fall through
    }
  }
  return [
    'UTC',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Madrid',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
  ]
}

export default function TeamSettingsModal({ team, products, onClose, onSaved }: TeamSettingsModalProps) {
  const initialTimezone = team.timezone ?? ''
  const initialProductId = team.default_product_id ?? ''

  const [timezone, setTimezone] = React.useState(initialTimezone)
  const [defaultProductId, setDefaultProductId] = React.useState(initialProductId)
  const [saving, setSaving] = React.useState(false)
  const [toast, setToast] = React.useState<Toast | null>(null)

  const timezones = React.useMemo(() => getSupportedTimezones(), [])
  const browserTimezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return ''
    }
  }, [])

  React.useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isDirty = timezone !== initialTimezone || defaultProductId !== initialProductId
  const canSave = !!supabase && isDirty && !saving

  const handleSave = async () => {
    if (!supabase || !canSave) return
    setSaving(true)
    const nextTimezone = timezone.trim() || null
    const nextProductId = defaultProductId || null
    const { error } = await supabase
      .from('teams')
      .update({ timezone: nextTimezone, default_product_id: nextProductId })
      .eq('id', team.id)
    setSaving(false)
    if (error) {
      setToast({ message: error.message, tone: 'error' })
      return
    }
    setToast({ message: 'Settings saved.', tone: 'success' })
    onSaved({ timezone: nextTimezone, default_product_id: nextProductId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" role="dialog" aria-modal="true" aria-label={`Settings for ${team.name}`}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close settings panel"
        className="absolute inset-0 bg-black/40 cursor-default"
      />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white dark:bg-gray-900 shadow-xl border-l border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-teal-600 dark:text-mushi-primary" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">Settings</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-[260px]">{team.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label htmlFor="team-timezone" className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Timezone</label>
            <select
              id="team-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            >
              <option value="">Use viewer's local timezone{browserTimezone && ` (${browserTimezone})`}</option>
              {timezones.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">Used when formatting team timestamps in absolute form.</p>
          </div>

          <div>
            <label htmlFor="team-default-product" className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Default product</label>
            <select
              id="team-default-product"
              value={defaultProductId}
              onChange={(event) => setDefaultProductId(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
              disabled={products.length === 0}
            >
              <option value="">No default</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">
              {products.length === 0
                ? 'Add a product to this team first.'
                : 'Pre-selected when creating a new session for this team.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 disabled:bg-slate-400 disabled:border-slate-400 transition-colors cursor-pointer disabled:cursor-default"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        {toast && (
          <div className={`absolute bottom-20 right-4 z-20 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg bg-white dark:bg-mushi-surface border-slate-200 dark:border-gray-700 ${toast.tone === 'success' ? 'text-teal-600 dark:text-mushi-primary' : 'text-red-600 dark:text-red-400'}`}>
            {toast.tone === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  )
}
