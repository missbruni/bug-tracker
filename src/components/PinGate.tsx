import { useState, type ReactNode } from 'react'

const TEAM_PIN = import.meta.env.VITE_TEAM_PIN as string | undefined
const SESSION_KEY = 'bug-tracker-auth'

interface PinGateProps {
  children: ReactNode
}

export default function PinGate({ children }: PinGateProps) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  if (!TEAM_PIN || authed) return <>{children}</>

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === TEAM_PIN) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
      <form onSubmit={submit} className="w-80 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-lg">
        <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100 mb-1" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 14 }}>
          EVO Bug Tracker
        </h1>
        <p className="text-xs text-slate-400 dark:text-gray-500 mb-6">Enter team PIN to continue</p>
        <input
          type="password"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false) }}
          placeholder="PIN"
          autoFocus
          className={`w-full rounded-lg border ${error ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-gray-600'} bg-slate-50 dark:bg-gray-800 px-4 py-3 text-center text-lg tracking-widest text-slate-900 dark:text-white outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all`}
        />
        {error && <p className="mt-2 text-xs text-red-500">Wrong PIN. Try again.</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer"
        >
          Enter
        </button>
      </form>
    </div>
  )
}
