/// <reference lib="dom" />
import { test, expect, describe, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import BugCard, { type Bug } from '../BugCard'

// Mock supabase to avoid real DB calls
mock.module('../../supabaseClient', () => ({ supabase: null }))

const baseBug: Bug = {
  id: 'C01',
  title: 'Login button broken',
  description: 'The login button does not respond on mobile',
  severity: 'critical',
  tester: 'Alice',
  device: 'iPhone 15',
  page: '/login',
  category: 'Auth',
  reviewed: false,
  comments: [],
  attachments: [],
}

const noop = () => {}

function renderBugCard(bugOverrides: Partial<Bug> = {}, props: { onUpdate?: (b: Bug) => void; onDelete?: (id: string) => void; onReviewed?: (b: Bug, undo: () => void) => void } = {}) {
  const bug = { ...baseBug, ...bugOverrides }
  return render(
    <BugCard
      bug={bug}
      onUpdate={props.onUpdate ?? noop}
      onDelete={props.onDelete ?? noop}
      onImageClick={noop}
      onReviewed={props.onReviewed}
    />,
  )
}

describe('BugCard', () => {
  test('renders bug id and title', () => {
    renderBugCard()
    expect(screen.getByText('C01')).toBeInTheDocument()
    expect(screen.getByText('Login button broken')).toBeInTheDocument()
  })

  test('renders tester name in badge', () => {
    renderBugCard()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  test('displays page and category', () => {
    renderBugCard()
    expect(screen.getByText('/login · Auth · iPhone 15')).toBeInTheDocument()
  })

  test('shows reviewed styling when bug is reviewed', () => {
    const { container } = renderBugCard({ reviewed: true })
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('opacity-60')
  })

  test('shows active styling when bug is not reviewed', () => {
    const { container } = renderBugCard({ reviewed: false })
    const card = container.firstElementChild as HTMLElement
    expect(card.className).not.toContain('opacity-60')
  })

  test('shows attachment count when attachments exist', () => {
    renderBugCard({
      attachments: [{ name: 'screenshot.png', url: 'https://example.com/img.png', type: 'image/png' }],
    })
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  test('shows comment count when comments exist', () => {
    renderBugCard({
      comments: [{ text: 'Reproduces on Android too' }, { text: 'Fixed in v2' }],
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('calls onUpdate when review toggle is clicked', () => {
    const onUpdate = mock(() => {})
    renderBugCard({}, { onUpdate })
    const reviewBtn = screen.getByTitle('Mark as reviewed')
    fireEvent.click(reviewBtn)
    expect(onUpdate).toHaveBeenCalled()
    const updatedBug = onUpdate.mock.calls[0][0] as Bug
    expect(updatedBug.reviewed).toBe(true)
  })

  test('expands card when clicked to reveal description', () => {
    renderBugCard({ description: 'Detailed steps to reproduce the issue' })
    // Description should not be visible before expanding
    expect(screen.queryByText('Detailed steps to reproduce the issue')).not.toBeInTheDocument()
    // Click the expand area (the button wrapping the title)
    const titleEl = screen.getByText('Login button broken')
    fireEvent.click(titleEl.closest('button')!)
    // Description should now be visible
    expect(screen.getByText('Detailed steps to reproduce the issue')).toBeInTheDocument()
  })
})
