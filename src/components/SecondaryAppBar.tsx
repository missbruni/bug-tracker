import { Search } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import AiBanner from './AiBanner'

interface SecondaryAppBarProps {
  /** First line of left column (description text) */
  description: ReactNode
  /** Second line of left column (stats text) */
  stats: ReactNode
  /** Search input value */
  search: string
  /** Search input change handler */
  onSearchChange: (value: string) => void
  /** Search input placeholder */
  searchPlaceholder?: string
  /** Optional ref for the search input */
  searchRef?: RefObject<HTMLInputElement | null>
  /** Whether to show the ⌘K shortcut badge on search */
  showSearchShortcut?: boolean
  /** Action button (rendered after the AI Assistant button) */
  actionButton?: ReactNode
}

export default function SecondaryAppBar({
  description,
  stats,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchRef,
  showSearchShortcut = false,
  actionButton,
}: SecondaryAppBarProps) {
  return (
    <>
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-slate-200 dark:border-gray-800/50 text-slate-900 dark:text-white">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-7 py-3 flex flex-wrap items-center justify-between gap-x-4 md:gap-x-8 gap-y-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 dark:text-gray-500 truncate">
              {description}
            </p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
              {stats}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto h-9">
            <div className="relative h-full flex-1 md:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={`h-full w-full md:w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60 pl-9 ${showSearchShortcut ? 'pr-16' : 'pr-3'} text-xs text-slate-900 dark:text-white outline-none focus:border-blue-400 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-400/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all`}
              />
              {showSearchShortcut && (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-300 font-mono pointer-events-none">⌘ K</kbd>
              )}
            </div>
            {actionButton}
          </div>
        </div>
      </div>
      <AiBanner />
    </>
  )
}
