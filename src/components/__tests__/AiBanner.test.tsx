/// <reference lib="dom" />
import { test, expect, describe, afterEach, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AiBanner from '../AiBanner'
import { useUIStore } from '../../lib/store'

const DISMISSED_KEY = 'ai-banner-dismissed'

beforeEach(() => {
  localStorage.removeItem(DISMISSED_KEY)
})

afterEach(() => {
  cleanup()
  localStorage.removeItem(DISMISSED_KEY)
})

describe('AiBanner', () => {
  test('renders banner when not dismissed', () => {
    render(<AiBanner />)
    expect(screen.getByText(/New: AI Assistant/)).toBeInTheDocument()
    expect(screen.getByText('Try now')).toBeInTheDocument()
  })

  test('does not render when previously dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    render(<AiBanner />)
    expect(screen.queryByText(/New: AI Assistant/)).not.toBeInTheDocument()
  })

  test('dismisses when X is clicked', () => {
    render(<AiBanner />)
    fireEvent.click(screen.getByTitle('Dismiss'))
    expect(screen.queryByText(/New: AI Assistant/)).not.toBeInTheDocument()
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true')
  })

  test('dismisses and opens AI panel when Try now is clicked', () => {
    useUIStore.setState({ aiPanelOpen: false })
    render(<AiBanner />)
    fireEvent.click(screen.getByText('Try now'))
    expect(screen.queryByText(/New: AI Assistant/)).not.toBeInTheDocument()
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true')
    expect(useUIStore.getState().aiPanelOpen).toBe(true)
  })
})
