import { Users, Target, Clock, Bug } from 'lucide-react'

interface SessionSummaryBannerProps {
  assignedCount: number
  totalTesters: number
  assignedScenarios: number
  totalScenarios: number
  isCompleted: boolean
  bugCount: number
  durationSeconds: number | null
  timerElapsed: number | null
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad(secs)}s`
  return `${secs}s`
}

function getBugRateLabel(bugCount: number, testerCount: number): { label: string; sublabel: string; color: string } {
  if (testerCount === 0) return { label: '—', sublabel: 'No testers', color: 'text-slate-400 dark:text-gray-500' }
  const ratio = bugCount / testerCount
  if (ratio >= 2) return { label: 'High', sublabel: 'Optimal Efficiency', color: 'text-blue-500' }
  if (ratio >= 1) return { label: 'Medium', sublabel: 'Good Coverage', color: 'text-amber-400 dark:text-yellow-400' }
  if (bugCount > 0) return { label: 'Low', sublabel: 'Light Findings', color: 'text-slate-500 dark:text-gray-400' }
  return { label: 'None', sublabel: 'No bugs found', color: 'text-slate-400 dark:text-gray-500' }
}

export default function SessionSummaryBanner({
  assignedCount,
  totalTesters,
  assignedScenarios,
  totalScenarios,
  isCompleted,
  bugCount,
  durationSeconds,
  timerElapsed,
}: SessionSummaryBannerProps) {
  const coveragePercent = totalScenarios > 0 ? Math.round((assignedScenarios / totalScenarios) * 100) : 0
  const bugRate = getBugRateLabel(bugCount, assignedCount)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {/* Active Testers */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={12} className="text-slate-400 dark:text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-500">Active Testers</span>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-gray-100 font-heading">
          {assignedCount} <span className="text-slate-400 dark:text-gray-600">/ {totalTesters}</span>
        </p>
        <div className="mt-2 flex gap-0.5">
          {Array.from({ length: totalTesters }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < assignedCount
                  ? 'bg-blue-500'
                  : 'bg-slate-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scenario Coverage */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Target size={12} className="text-slate-400 dark:text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-500">Scenario Coverage</span>
        </div>
        <p className="text-2xl font-bold text-blue-500 font-heading">{coveragePercent}%</p>
        <div className="mt-2 flex gap-0.5">
          {Array.from({ length: Math.max(totalScenarios, 1) }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < assignedScenarios
                  ? 'bg-red-400 dark:bg-mushi-accent'
                  : 'bg-slate-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Clock size={12} className="text-slate-400 dark:text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-500">
            {isCompleted ? 'Duration' : 'Est. Duration'}
          </span>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-gray-100 font-heading">
          {durationSeconds != null
            ? formatDuration(durationSeconds)
            : timerElapsed != null
              ? formatDuration(Math.floor(timerElapsed / 1000))
              : '—'}
        </p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-gray-500 truncate">
          {durationSeconds != null
            ? 'Session completed'
            : timerElapsed != null
              ? 'Timer running...'
              : 'No timer started'}
        </p>
      </div>

      {/* Bug Detection Rate */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Bug size={12} className="text-slate-400 dark:text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-500">Bug Detection Rate</span>
        </div>
        <p className={`text-2xl font-bold font-heading ${bugRate.color}`}>{bugRate.label}</p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-gray-500">{bugRate.sublabel}</p>
      </div>
    </div>
  )
}
