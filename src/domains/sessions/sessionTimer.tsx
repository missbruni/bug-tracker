import React, { createContext } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../../supabaseClient'
import { useTeamAccess } from '../../lib/teamAccess'
import { scopeToTeam } from '../../lib/teamScope'

export type TimerStatus = 'idle' | 'running' | 'paused'

interface TimerState {
  sessionId: string
  sessionName: string
  status: TimerStatus
  /** Total accumulated ms before the current run */
  accumulated: number
  /** Timestamp when current run started (null if paused/idle) */
  startedAt: number | null
}

interface SessionTimerContextValue {
  /** Current timer state (null = no active timer) */
  timer: TimerState | null
  /** Live elapsed time in ms */
  elapsed: number
  /** Start or resume the timer for a session */
  startTimer: (sessionId: string, sessionName: string) => void
  /** Pause the timer */
  pauseTimer: () => void
  /** Resume a paused timer */
  resumeTimer: () => void
  /** Stop the timer and save duration to DB. Returns error string on failure. */
  stopTimer: () => Promise<{ error?: string }>
  /** Discard the timer without saving */
  discardTimer: () => void
}

const STORAGE_KEY = 'mushi-session-timer'

function loadState(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TimerState
  } catch (err) {
    console.warn('[sessionTimer] corrupt localStorage, resetting:', err)
    return null
  }
}

function saveState(state: TimerState | null) {
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

const SessionTimerContext = createContext<SessionTimerContextValue | null>(null)

export function SessionTimerProvider({ children }: { children: ReactNode }) {
  const { activeTeamId } = useTeamAccess()
  const [timer, setTimer] = React.useState<TimerState | null>(loadState)
  const [elapsed, setElapsed] = React.useState(0)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist timer state to localStorage on change
  React.useEffect(() => {
    saveState(timer)
  }, [timer])

  // Tick the elapsed counter
  React.useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!timer) {
      setElapsed(0)
      return
    }

    const computeElapsed = () => {
      if (timer.status === 'running' && timer.startedAt) {
        return timer.accumulated + (Date.now() - timer.startedAt)
      }
      return timer.accumulated
    }

    setElapsed(computeElapsed())

    if (timer.status === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsed(computeElapsed())
      }, 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timer])

  const startTimer = (sessionId: string, sessionName: string) => {
    setTimer(prev => {
      // If already tracking this session and paused, resume
      if (prev && prev.sessionId === sessionId && prev.status === 'paused') {
        return { ...prev, status: 'running', startedAt: Date.now() }
      }
      // Start fresh
      return {
        sessionId,
        sessionName,
        status: 'running',
        accumulated: 0,
        startedAt: Date.now(),
      }
    })
  }

  const pauseTimer = () => {
    setTimer(prev => {
      if (!prev || prev.status !== 'running' || !prev.startedAt) return prev
      return {
        ...prev,
        status: 'paused',
        accumulated: prev.accumulated + (Date.now() - prev.startedAt),
        startedAt: null,
      }
    })
  }

  const resumeTimer = () => {
    setTimer(prev => {
      if (!prev || prev.status !== 'paused') return prev
      return { ...prev, status: 'running', startedAt: Date.now() }
    })
  }

  const stopTimer = async (): Promise<{ error?: string }> => {
    const current = timer
    if (!current) return {}

    // Calculate final duration
    let totalMs = current.accumulated
    if (current.status === 'running' && current.startedAt) {
      totalMs += Date.now() - current.startedAt
    }
    const durationSeconds = Math.round(totalMs / 1000)

    // Save to DB
    if (supabase) {
      try {
        const { error } = await scopeToTeam(
          supabase.from('sessions').update({ duration_seconds: durationSeconds }).eq('id', current.sessionId),
          activeTeamId,
        )
        if (error) {
          console.error('[stopTimer] Failed to save duration:', error.message)
          return { error: `Failed to save duration: ${error.message}` }
        }
      } catch (err) {
        console.error('[stopTimer] Network error:', err)
        return { error: 'Network error — duration not saved. Please try again.' }
      }
    }

    // Only clear timer after successful save
    setTimer(null)
    return {}
  }

  const discardTimer = () => {
    setTimer(null)
  }

  return (
    <SessionTimerContext.Provider value={{ timer, elapsed, startTimer, pauseTimer, resumeTimer, stopTimer, discardTimer }}>
      {children}
    </SessionTimerContext.Provider>
  )
}

export function useSessionTimer(): SessionTimerContextValue {
  const ctx = React.useContext(SessionTimerContext)
  if (!ctx) throw new Error('useSessionTimer must be used within SessionTimerProvider')
  return ctx
}
