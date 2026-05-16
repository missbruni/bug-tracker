import { ArrowDownUp } from 'lucide-react'
import type { Bug, SessionOption } from '../types'
import type { Severity } from '../constants'

interface FilterBarProps {
  bugs: Bug[]
  activeBugs: Bug[]
  counts: Record<Severity, number>
  severityFilter: string
  setSeverityFilter: (value: string) => void
  testerFilter: string
  setTesterFilter: (value: string) => void
  dateFilter: string
  setDateFilter: (value: string) => void
  sessionFilter: string
  setSessionFilter: (value: string) => void
  sortOrder: string
  setSortOrder: (value: string) => void
  testers: string[]
  sessions: SessionOption[]
}

export default function FilterBar({
  bugs,
  activeBugs,
  counts,
  severityFilter,
  setSeverityFilter,
  testerFilter,
  setTesterFilter,
  dateFilter,
  setDateFilter,
  sessionFilter,
  setSessionFilter,
  sortOrder,
  setSortOrder,
  testers,
  sessions,
}: FilterBarProps) {
  const selectedActiveSeverities = new Set(
    severityFilter
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  )

  const filters = [
    { key: 'all', label: `Active (${activeBugs.length})` },
    { key: 'critical', label: `Critical (${counts.critical})` },
    { key: 'high', label: `High (${counts.high})` },
    { key: 'low', label: `Low (${counts.low})` },
    { key: 'completed', label: `Completed (${bugs.filter((bug) => bug.reviewed).length})` },
  ]

  return (
    <div className="border-b border-slate-200 dark:border-gray-800">
      <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center gap-2 px-7 py-3.5">
        {filters.map((filterOption) => {
          const isSelected = filterOption.key === 'all' || filterOption.key === 'completed'
            ? severityFilter === filterOption.key
            : selectedActiveSeverities.has(filterOption.key)

          return (
            <button
              key={filterOption.key}
              onClick={() => setSeverityFilter(filterOption.key)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
              }`}
            >
              {filterOption.label}
            </button>
          )
        })}
        <select
          value={testerFilter}
          onChange={(event) => setTesterFilter(event.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
        >
          <option value="all">All testers</option>
          {testers.map((testerName) => (
            <option key={testerName} value={testerName}>{testerName}</option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        {sessions.length > 0 && (
          <select
            value={sessionFilter}
            onChange={(event) => setSessionFilter(event.target.value)}
            className="rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-400"
          >
            <option value="all">All sessions</option>
            <option value="none">No session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>{session.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : sortOrder === 'oldest' ? 'default' : 'newest')}
          className={`ml-auto flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            sortOrder !== 'default'
              ? 'bg-slate-900 dark:bg-gray-100 text-white dark:text-gray-900 border-slate-900 dark:border-gray-100'
              : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
          }`}
          title={sortOrder === 'newest' ? 'Newest first' : sortOrder === 'oldest' ? 'Oldest first' : 'Default order'}
        >
          <ArrowDownUp size={12} />
          {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Sort'}
        </button>
      </div>
    </div>
  )
}
