import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, Square, X } from 'lucide-react'
import { useSessionTimer } from '../lib/sessionTimer'
import ConfirmModal from './ConfirmModal'

function TickingClock({ animate }: { animate: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-mushi-primary shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="12" x2="12" y2="7" />
      <line
        x1="12" y1="12" x2="16" y2="12"
        style={animate ? {
          transformOrigin: '12px 12px',
          animation: 'spin-second 10s linear infinite',
        } : undefined}
      />
    </svg>
  )
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

export default function SessionTimerBar() {
  const { timer, elapsed, pauseTimer, resumeTimer, stopTimer, discardTimer } = useSessionTimer()
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [bump, setBump] = useState(false)
  const prevMinutes = useRef(-1)

  const currentMinutes = Math.floor(elapsed / 60000)
  useEffect(() => {
    if (prevMinutes.current !== -1 && currentMinutes !== prevMinutes.current) {
      setBump(true)
      const t = setTimeout(() => setBump(false), 300)
      return () => clearTimeout(t)
    }
    prevMinutes.current = currentMinutes
  }, [currentMinutes])

  if (!timer) return null

  const isRunning = timer.status === 'running'
  const isPaused = timer.status === 'paused'

  return (
    <>
      <div className="sticky top-[var(--navbar-h)] z-40 border-b border-blue-200 dark:border-mushi-outline bg-blue-50 dark:bg-mushi-neutral">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-7 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <TickingClock animate={isRunning} />
            <div className="min-w-0">
              <Link
                to={`/sessions/${timer.sessionId}`}
                className="text-xs font-bold text-slate-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-mushi-primary truncate block"
              >
                {timer.sessionName}
              </Link>
              <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wide">
                {isRunning ? 'Timer running' : 'Timer paused'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`font-heading text-lg font-bold text-slate-900 dark:text-gray-100 tabular-nums tracking-wide min-w-[5ch] text-right transition-transform duration-300 ${bump ? 'scale-110' : 'scale-100'}`}
            >
              {formatTimer(elapsed)}
            </span>

            <div className="flex items-center gap-1">
              {isRunning ? (
                <button
                  onClick={pauseTimer}
                  className="flex items-center gap-1 rounded-md bg-amber-100 dark:bg-gray-800 border border-amber-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  title="Pause timer"
                >
                  <Pause size={12} /> Pause
                </button>
              ) : isPaused ? (
                <button
                  onClick={resumeTimer}
                  className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer"
                  title="Resume timer"
                >
                  <Play size={12} /> Resume
                </button>
              ) : null}

              <button
                onClick={() => setShowStopConfirm(true)}
                className="flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                title="Stop & save"
              >
                <Square size={10} fill="currentColor" /> Stop
              </button>

              <button
                onClick={discardTimer}
                className="p-1.5 rounded-md text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Discard timer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showStopConfirm && (
        <ConfirmModal
          title="Stop session timer?"
          confirmLabel="Stop & save duration"
          onConfirm={async () => {
            await stopTimer()
            setShowStopConfirm(false)
          }}
          onCancel={() => setShowStopConfirm(false)}
        >
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-2 leading-relaxed">
            This will save <span className="font-bold text-slate-700 dark:text-gray-300">{formatTimer(elapsed)}</span> as
            the duration for <span className="font-bold text-slate-700 dark:text-gray-300">{timer.sessionName}</span>.
          </p>
        </ConfirmModal>
      )}
    </>
  )
}
