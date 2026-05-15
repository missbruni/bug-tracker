/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'

// Mock supabase to avoid real DB calls
mock.module('../../supabaseClient', () => ({ supabase: null }))

// Must import after mock
const { default: FeedbackModal } = await import('../FeedbackModal')

afterEach(() => cleanup())

describe('FeedbackModal', () => {
  test('inline mode renders without modal overlay', () => {
    const { container } = render(
      <FeedbackModal sessionId="s1" sessionName="Test Session" onClose={() => {}} inline />
    )
    // Should NOT have the fixed overlay backdrop
    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).toBeNull()
  })

  test('inline mode does not render close button', () => {
    render(
      <FeedbackModal sessionId="s1" sessionName="Test Session" onClose={() => {}} inline />
    )
    // The close X button should not be present
    const buttons = screen.queryAllByRole('button')
    const closeBtn = buttons.find(b => b.querySelector('.lucide-x'))
    expect(closeBtn).toBeUndefined()
  })

  test('inline mode does not render the form or thanks section', () => {
    render(
      <FeedbackModal sessionId="s1" sessionName="Test Session" onClose={() => {}} inline />
    )
    expect(screen.queryByText('Submit Feedback')).toBeNull()
    expect(screen.queryByText('Thanks for your feedback!')).toBeNull()
  })

  test('modal mode renders with overlay', () => {
    const { container } = render(
      <FeedbackModal sessionId="s1" sessionName="Test Session" onClose={() => {}} />
    )
    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
  })

  test('modal mode renders header with session name', () => {
    render(
      <FeedbackModal sessionId="s1" sessionName="My Session" onClose={() => {}} />
    )
    expect(screen.getByText('My Session')).toBeInTheDocument()
    expect(screen.getByText('Session Feedback')).toBeInTheDocument()
  })
})
