import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bug, Presentation, Users } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Bugs', icon: Bug },
  { to: '/sessions', label: 'Sessions', icon: Presentation },
  { to: '/testers', label: 'Testers', icon: Users },
]

export default function NavBar({ children }: { children?: ReactNode }) {
  const location = useLocation()

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800">
      {/* Branding row */}
      <div className="max-w-screen-2xl mx-auto px-7 pt-4 pb-2 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-3 mb-0.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-1" style={{ fontFamily: "'Press Start 2P', cursive" }}>EVO <Bug size={20} className="text-green-500" /> IBE</h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-gray-300">Testing Session Triage | Bug Catcher</p>
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500">
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {children && <div className="flex items-center">{children}</div>}
      </div>
      {/* Tab navigation */}
      <div className="max-w-screen-2xl mx-auto px-7 flex items-center gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                active
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
