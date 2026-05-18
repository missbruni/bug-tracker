/// <reference lib="dom" />
import { test, expect, describe, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// ─── formatTimer (extracted logic) ─────────────────────────

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

describe('formatTimer', () => {
  test('formats zero', () => {
    expect(formatTimer(0)).toBe('00:00')
  })

  test('formats seconds only', () => {
    expect(formatTimer(5000)).toBe('00:05')
    expect(formatTimer(59000)).toBe('00:59')
  })

  test('formats minutes and seconds', () => {
    expect(formatTimer(61000)).toBe('01:01')
    expect(formatTimer(600000)).toBe('10:00')
  })

  test('formats hours', () => {
    expect(formatTimer(3600000)).toBe('1:00:00')
    expect(formatTimer(3661000)).toBe('1:01:01')
    expect(formatTimer(36000000)).toBe('10:00:00')
  })

  test('pads correctly', () => {
    expect(formatTimer(62000)).toBe('01:02')
    expect(formatTimer(3723000)).toBe('1:02:03')
  })
})

// ─── TickingClock SVG ──────────────────────────────────────

function TickingClock({ animate }: { animate: boolean }) {
  return (
    <svg data-testid="clock" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-mushi-primary shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="12" x2="12" y2="7" />
      <line
        data-testid="second-hand"
        x1="12" y1="12" x2="16" y2="12"
        style={animate ? {
          transformOrigin: '12px 12px',
          animation: 'spin-second 10s linear infinite',
        } : undefined}
      />
    </svg>
  )
}

describe('TickingClock', () => {
  test('renders SVG with two hands', () => {
    const { container } = render(<TickingClock animate={false} />)
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(2)
  })

  test('second hand has animation when animate=true', () => {
    render(<TickingClock animate={true} />)
    const hand = document.querySelector('[data-testid="second-hand"]') as HTMLElement
    expect(hand.style.animation).toContain('spin-second')
  })

  test('second hand has no animation when animate=false', () => {
    render(<TickingClock animate={false} />)
    const hand = document.querySelector('[data-testid="second-hand"]') as HTMLElement
    expect(hand.style.animation).toBe('')
  })
})
