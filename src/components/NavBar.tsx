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
    <nav className="border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
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
        {children && <div className="ml-auto flex items-center">{children}</div>}
      </div>
    </nav>
  )
}
