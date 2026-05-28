import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth, getUserDisplayName } from '../lib/useAuth'

type Toast = { message: string; tone: 'success' | 'error' }

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
}

export default function UserProfilePage() {
  const { user } = useAuth()
  const metadata = (user?.user_metadata as Record<string, unknown> | undefined) ?? {}
  const initialName =
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    ''
  const initialAvatar =
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()) ||
    (typeof metadata.picture === 'string' && metadata.picture.trim()) ||
    ''

  const [name, setName] = React.useState(initialName)
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatar)
  const [saving, setSaving] = React.useState(false)
  const [toast, setToast] = React.useState<Toast | null>(null)

  React.useEffect(() => {
    setName(initialName)
    setAvatarUrl(initialAvatar)
  }, [initialName, initialAvatar])

  React.useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const trimmedName = name.trim()
  const trimmedAvatar = avatarUrl.trim()
  const isDirty = trimmedName !== initialName || trimmedAvatar !== initialAvatar
  const canSave = !!supabase && !!user && isDirty && !saving

  const handleSave = async () => {
    if (!supabase || !user || !canSave) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        name: trimmedName || null,
        avatar_url: trimmedAvatar || null,
      },
    })
    setSaving(false)
    if (error) {
      setToast({ message: error.message, tone: 'error' })
      return
    }
    setToast({ message: 'Profile updated.', tone: 'success' })
  }

  const handleReset = () => {
    setName(initialName)
    setAvatarUrl(initialAvatar)
  }

  const displayName = user ? getUserDisplayName(user) : 'Unknown'
  const previewAvatar = trimmedAvatar || undefined

  return (
    <div className="max-w-screen-md mx-auto px-4 sm:px-7 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-heading uppercase tracking-tight">Profile</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Update how your name and avatar appear across teams.</p>
        </div>

        {!user ? (
          <div className="text-sm text-slate-500 dark:text-gray-500">Sign in to manage your profile.</div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center gap-4 mb-6">
              {previewAvatar ? (
                <img
                  src={previewAvatar}
                  alt={`${displayName} avatar`}
                  className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-gray-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 dark:bg-gray-700 text-lg font-bold text-slate-700 dark:text-gray-200">
                  {getInitials(displayName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900 dark:text-gray-100 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="profile-email" className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={user.email || ''}
                  readOnly
                  className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">Email is managed by your identity provider.</p>
              </div>

              <div>
                <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Display name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="How others will see you"
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="profile-avatar" className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">Avatar URL</label>
                <input
                  id="profile-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">Paste a link to an image. Leave blank to use your initials.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-bold text-white dark:text-mushi-bg hover:bg-blue-600 hover:border-blue-600 disabled:bg-slate-400 disabled:border-slate-400 transition-colors cursor-pointer disabled:cursor-default"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                onClick={handleReset}
                disabled={!isDirty || saving}
                className="rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg bg-white dark:bg-mushi-surface border-slate-200 dark:border-gray-700 ${toast.tone === 'success' ? 'text-teal-600 dark:text-mushi-primary' : 'text-red-600 dark:text-red-400'}`}>
          {toast.tone === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
