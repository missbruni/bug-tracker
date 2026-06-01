import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  PieChart, Pie,
  Legend,
} from 'recharts'
import { TrendingUp, Bug, Crosshair } from 'lucide-react'
import useAnalytics, { type TimePreset } from '../domains/bugs/useAnalytics'
import { useBugKillLeaderboard } from '../domains/bugs/useBugKills'
import { usePanelStore } from '../stores/panelStore'
import { getAnalyticsPalette, type AnalyticsPalette } from '../domains/bugs/analyticsColors'

const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

// ─── Stat Card ───────────────────────────────────────────────

function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide truncate">{label}</span>
      <span className="text-2xl font-bold text-slate-900 dark:text-gray-100 font-heading">{value}</span>
      {detail && <span className="text-xs text-slate-400 dark:text-gray-600 truncate">{detail}</span>}
    </div>
  )
}

// ─── Chart Card wrapper ──────────────────────────────────────

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 font-heading">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Custom Tooltip ──────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 dark:text-gray-400 capitalize">{entry.name}:</span>
          <span className="font-bold text-slate-700 dark:text-gray-200">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Bug Trends Chart ────────────────────────────────────────

function BugTrendsChart({ data, palette }: { data: ReturnType<typeof useAnalytics>['bugTrends']; palette: AnalyticsPalette }) {
  if (!data.length) {
    return <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-8">No bug data in this period</p>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={palette.critical} stopOpacity={0.3} />
            <stop offset="95%" stopColor={palette.critical} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={palette.high} stopOpacity={0.3} />
            <stop offset="95%" stopColor={palette.high} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={palette.low} stopOpacity={0.3} />
            <stop offset="95%" stopColor={palette.low} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: palette.text }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: palette.text }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="critical" name="Critical" stroke={palette.critical} fill="url(#gradCritical)" strokeWidth={2} animationDuration={800} />
        <Area type="monotone" dataKey="high" name="High" stroke={palette.high} fill="url(#gradHigh)" strokeWidth={2} animationDuration={800} />
        <Area type="monotone" dataKey="low" name="Low" stroke={palette.low} fill="url(#gradLow)" strokeWidth={2} animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Tester Performance Chart ────────────────────────────────

function TesterPerformanceChart({ data, palette }: { data: ReturnType<typeof useAnalytics>['testerPerformance']; palette: AnalyticsPalette }) {
  const top = data.slice(0, 8)
  if (!top.length) {
    return <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-8">No tester data yet</p>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={top} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: palette.text }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="tester" tick={{ fontSize: 11, fill: palette.text }} tickLine={false} axisLine={false} width={90} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="critical" name="Critical" stackId="severity" fill={palette.critical} animationDuration={600} radius={[0, 0, 0, 0]} />
        <Bar dataKey="high" name="High" stackId="severity" fill={palette.high} animationDuration={600} />
        <Bar dataKey="low" name="Low" stackId="severity" fill={palette.low} animationDuration={600} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Session Analytics Chart ─────────────────────────────────

interface PieEntry {
  name: string
  value: number
}

function SessionStatusChart({ data, palette }: { data: ReturnType<typeof useAnalytics>['sessionStatus']; palette: AnalyticsPalette }) {
  if (data.total === 0) {
    return <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-8">No sessions yet</p>
  }

  const pieData: PieEntry[] = [
    { name: 'Draft', value: data.draft },
    { name: 'Active', value: data.active },
    { name: 'Completed', value: data.completed },
  ].filter((entry) => entry.value > 0)

  const filteredColors = [
    data.draft > 0 ? palette.draft : null,
    data.active > 0 ? palette.active : null,
    data.completed > 0 ? palette.completed : null,
  ].filter(Boolean) as string[]

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            animationDuration={800}
            animationBegin={200}
          >
            {pieData.map((_entry, index) => (
              <Cell key={_entry.name} fill={filteredColors[index]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2">
        {[
          { label: 'Draft', value: data.draft, color: palette.draft },
          { label: 'Active', value: data.active, color: palette.active },
          { label: 'Completed', value: data.completed, color: palette.completed },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-slate-600 dark:text-gray-400">{item.label}</span>
            <span className="text-xs font-bold text-slate-800 dark:text-gray-200">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Avatar circle (image or initials fallback) ──────────────

function LeaderAvatar({ displayName, avatarUrl, size = 36 }: { displayName: string; avatarUrl?: string; size?: number }) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const style = { width: size, height: size, minWidth: size }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
        style={style}
      />
    )
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-gray-700 text-[11px] font-bold text-slate-700 dark:text-gray-200 ring-2 ring-white dark:ring-gray-900 shrink-0"
      style={style}
    >
      {initials}
    </span>
  )
}

// ─── Bug Killer Leaderboard ──────────────────────────────────

function BugKillerLeaderboard({ palette }: { palette: AnalyticsPalette }) {
  const { leaderboard, isLoading } = useBugKillLeaderboard()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-2">
        {[1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-gray-800 animate-pulse shrink-0" />
            <div className="flex-1 h-6 rounded-full bg-slate-100 dark:bg-gray-800 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!leaderboard.length) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-400 dark:text-gray-600">No kills yet!</p>
        <p className="text-xs text-slate-300 dark:text-gray-700 mt-1">Click the crawling bugs in the nav bar to squash them</p>
      </div>
    )
  }

  const maxKills = leaderboard[0]?.killCount ?? 1
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div className="flex flex-col gap-3">
      {leaderboard.slice(0, 6).map((entry, index) => {
        const barWidth = Math.max(6, (entry.killCount / maxKills) * 100)
        return (
          <div key={entry.userId} className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <LeaderAvatar displayName={entry.displayName} avatarUrl={entry.avatarUrl} size={36} />
              {index < 3 && (
                <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">{MEDALS[index]}</span>
              )}
            </div>

            {/* Bar + name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-gray-300 truncate">{entry.displayName}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-gray-400 shrink-0 tabular-nums">
                  {entry.killCount} {entry.killCount === 1 ? 'kill' : 'kills'}
                </span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${barWidth}%`, backgroundColor: palette.kill }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-6 space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 rounded-xl bg-slate-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-80 rounded-xl bg-slate-100 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [preset, setPreset] = React.useState<TimePreset>('30d')
  const isDark = usePanelStore((state) => state.isDark)
  const palette = getAnalyticsPalette(isDark)
  const analytics = useAnalytics(preset)

  if (analytics.isLoading) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100 font-heading">Analytics</h1>
          <p className="text-xs text-slate-500 dark:text-gray-500">Bug trends, tester performance, and session insights</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-gray-800 p-0.5">
          {TIME_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPreset(value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                preset === value
                  ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 shadow-sm'
                  : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {analytics.statCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} detail={card.detail} />
        ))}
      </div>

      {/* Charts 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bug Trends */}
        <ChartCard title="Bug Trends" icon={<TrendingUp size={16} className="text-blue-500 dark:text-mushi-primary" />}>
          <BugTrendsChart data={analytics.bugTrends} palette={palette} />
        </ChartCard>

        {/* Tester Performance */}
        <ChartCard title="Tester Performance" icon={<Bug size={16} className="text-blue-500 dark:text-mushi-primary" />}>
          <TesterPerformanceChart data={analytics.testerPerformance} palette={palette} />
        </ChartCard>

        {/* Session Analytics */}
        <ChartCard title="Session Status" icon={<TrendingUp size={16} className="text-blue-500 dark:text-mushi-primary" />}>
          <SessionStatusChart data={analytics.sessionStatus} palette={palette} />
          {analytics.sessionBugs.length > 0 && (
            <div className="mt-2 border-t border-slate-100 dark:border-gray-800 pt-3">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-500 mb-2 uppercase tracking-wide">Top Sessions by Bugs</h4>
              <div className="flex flex-col gap-1.5">
                {analytics.sessionBugs.slice(0, 5).map((entry) => (
                  <div key={entry.sessionName} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-gray-400 truncate mr-2">{entry.sessionName}</span>
                    <span className="font-bold text-slate-700 dark:text-gray-300 shrink-0">{entry.bugCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Bug Killer Leaderboard */}
        <ChartCard title="Bug Killer Leaderboard" icon={<Crosshair size={16} className="text-mushi-accent" />}>
          <BugKillerLeaderboard palette={palette} />
        </ChartCard>
      </div>
    </div>
  )
}
