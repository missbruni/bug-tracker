/// <reference lib="dom" />
import { test, expect, describe, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// ─── formatDuration (extracted logic) ──────────────────────

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad(secs)}s`
  return `${secs}s`
}

describe('formatDuration', () => {
  test('formats seconds only', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(5)).toBe('5s')
    expect(formatDuration(59)).toBe('59s')
  })

  test('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m 00s')
    expect(formatDuration(61)).toBe('1m 01s')
    expect(formatDuration(600)).toBe('10m 00s')
    expect(formatDuration(754)).toBe('12m 34s')
  })

  test('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 00m')
    expect(formatDuration(3660)).toBe('1h 01m')
    expect(formatDuration(7200)).toBe('2h 00m')
    expect(formatDuration(5400)).toBe('1h 30m')
  })

  test('45 minutes = 2700 seconds', () => {
    expect(formatDuration(2700)).toBe('45m 00s')
  })
})

// ─── Duration display logic ────────────────────────────────

function DurationDisplay({ durationSeconds, timerElapsed }: { durationSeconds: number | null; timerElapsed: number | null }) {
  return (
    <div>
      <p data-testid="duration-value">
        {durationSeconds != null
          ? formatDuration(durationSeconds)
          : timerElapsed != null
            ? formatDuration(Math.floor(timerElapsed / 1000))
            : '—'}
      </p>
      <p data-testid="duration-label">
        {durationSeconds != null
          ? 'Session completed'
          : timerElapsed != null
            ? 'Timer running...'
            : 'No timer started'}
      </p>
    </div>
  )
}

describe('DurationDisplay', () => {
  test('shows saved duration when durationSeconds is set', () => {
    render(<DurationDisplay durationSeconds={2700} timerElapsed={null} />)
    expect(screen.getByTestId('duration-value')).toHaveTextContent('45m 00s')
    expect(screen.getByTestId('duration-label')).toHaveTextContent('Session completed')
  })

  test('shows live timer when timerElapsed is set', () => {
    render(<DurationDisplay durationSeconds={null} timerElapsed={65000} />)
    expect(screen.getByTestId('duration-value')).toHaveTextContent('1m 05s')
    expect(screen.getByTestId('duration-label')).toHaveTextContent('Timer running...')
  })

  test('shows dash when no timer and no saved duration', () => {
    render(<DurationDisplay durationSeconds={null} timerElapsed={null} />)
    expect(screen.getByTestId('duration-value')).toHaveTextContent('—')
    expect(screen.getByTestId('duration-label')).toHaveTextContent('No timer started')
  })

  test('saved duration takes precedence over live timer', () => {
    render(<DurationDisplay durationSeconds={120} timerElapsed={5000} />)
    expect(screen.getByTestId('duration-value')).toHaveTextContent('2m 00s')
    expect(screen.getByTestId('duration-label')).toHaveTextContent('Session completed')
  })
})

// ─── parseDuration ────────────────────────────────────────

function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null
  let totalSeconds = 0
  let matched = false
  const hMatch = trimmed.match(/(\d+)\s*h/)
  const mMatch = trimmed.match(/(\d+)\s*m/)
  const sMatch = trimmed.match(/(\d+)\s*s/)
  if (hMatch) { totalSeconds += parseInt(hMatch[1], 10) * 3600; matched = true }
  if (mMatch) { totalSeconds += parseInt(mMatch[1], 10) * 60; matched = true }
  if (sMatch) { totalSeconds += parseInt(sMatch[1], 10); matched = true }
  if (!matched) {
    const num = parseInt(trimmed, 10)
    if (!isNaN(num)) { totalSeconds = num * 60; matched = true }
  }
  return matched ? totalSeconds : null
}

describe('parseDuration', () => {
  test('parses hours and minutes', () => {
    expect(parseDuration('1h 30m')).toBe(5400)
    expect(parseDuration('2h 00m')).toBe(7200)
  })

  test('parses minutes only', () => {
    expect(parseDuration('45m')).toBe(2700)
    expect(parseDuration('90m')).toBe(5400)
  })

  test('parses minutes and seconds', () => {
    expect(parseDuration('5m 30s')).toBe(330)
  })

  test('parses plain number as minutes', () => {
    expect(parseDuration('30')).toBe(1800)
    expect(parseDuration('60')).toBe(3600)
  })

  test('returns null for empty input', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('  ')).toBeNull()
  })

  test('returns null for non-numeric input', () => {
    expect(parseDuration('abc')).toBeNull()
  })

  test('parses hours only', () => {
    expect(parseDuration('2h')).toBe(7200)
  })

  test('parses full h m s', () => {
    expect(parseDuration('1h 15m 30s')).toBe(4530)
  })
})

// ─── getBugRateLabel ───────────────────────────────────────

function getBugRateLabel(bugCount: number, testerCount: number): { label: string; sublabel: string } {
  if (testerCount === 0) return { label: '—', sublabel: 'No testers' }
  const ratio = bugCount / testerCount
  if (ratio >= 2) return { label: 'High', sublabel: 'Optimal Efficiency' }
  if (ratio >= 1) return { label: 'Medium', sublabel: 'Good Coverage' }
  if (bugCount > 0) return { label: 'Low', sublabel: 'Light Findings' }
  return { label: 'None', sublabel: 'No bugs found' }
}

describe('getBugRateLabel', () => {
  test('returns dash when no testers', () => {
    expect(getBugRateLabel(5, 0).label).toBe('—')
  })

  test('returns High when ratio >= 2', () => {
    expect(getBugRateLabel(10, 5).label).toBe('High')
    expect(getBugRateLabel(6, 3).label).toBe('High')
  })

  test('returns Medium when ratio >= 1', () => {
    expect(getBugRateLabel(5, 5).label).toBe('Medium')
    expect(getBugRateLabel(3, 2).label).toBe('Medium')
  })

  test('returns Low when bugs > 0 but ratio < 1', () => {
    expect(getBugRateLabel(1, 5).label).toBe('Low')
  })

  test('returns None when no bugs', () => {
    expect(getBugRateLabel(0, 5).label).toBe('None')
  })
})
