/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import BugCard from '../BugCard'
import type { Bug } from '../../types'

afterEach(() => cleanup())

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

function renderBugCard(bugOverrides: Partial<Bug> = {}, props: { onUpdate?: (b: Bug) => void; onDelete?: (id: string) => void; onReviewed?: (b: Bug, undo: () => void) => void; autoExpand?: boolean } = {}) {
  const bug = { ...baseBug, ...bugOverrides }
  return render(
    <BugCard
      bug={bug}
      onUpdate={props.onUpdate ?? noop}
      onDelete={props.onDelete ?? noop}
      onImageClick={noop}
      onReviewed={props.onReviewed}
      autoExpand={props.autoExpand}
    />,
  )
}

describe('BugCard', () => {
  test('renders bug id and title', () => {
    renderBugCard()
    expect(screen.getByText('C01')).toBeInTheDocument()
    expect(screen.getByText('Login button broken')).toBeInTheDocument()
  })

  test('shows a copy-link button in the collapsed row', () => {
    renderBugCard()
    expect(screen.getByTitle('Copy link to bug')).toBeInTheDocument()
  })

  test('shows a Copy Link button when expanded', () => {
    renderBugCard({ description: 'Steps to reproduce' })
    fireEvent.click(screen.getByText('Login button broken').closest('button')!)
    expect(screen.getByText('Copy Link')).toBeInTheDocument()
  })

  test('renders tester name in badge', () => {
    renderBugCard()
    const elements = screen.getAllByText('Alice')
    expect(elements.length).toBeGreaterThan(0)
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
    // Description is in DOM but hidden (collapse-grid without open)
    const desc = screen.getByText('Detailed steps to reproduce the issue')
    expect(desc.closest('.collapse-grid')!.classList.contains('open')).toBe(false)
    // Click the expand area (the button wrapping the title)
    const titleEl = screen.getByText('Login button broken')
    fireEvent.click(titleEl.closest('button')!)
    // Description should now be visible (collapse-grid has open class)
    expect(desc.closest('.collapse-grid')!.classList.contains('open')).toBe(true)
  })

  test('auto-expands when requested', () => {
    renderBugCard({ description: 'Detailed steps to reproduce the issue' }, { autoExpand: true })

    const desc = screen.getByText('Detailed steps to reproduce the issue')
    expect(desc.closest('.collapse-grid')!.classList.contains('open')).toBe(true)
  })

  test('shows inline confirm when row trash icon is clicked', () => {
    renderBugCard()
    fireEvent.click(screen.getByTitle('Delete bug'))

    expect(screen.getByText('Delete?')).toBeInTheDocument()
    expect(screen.getByTitle('Confirm delete')).toBeInTheDocument()
    expect(screen.getByTitle('Cancel delete')).toBeInTheDocument()
  })

  test('expanded delete button triggers inline row confirm', () => {
    renderBugCard({ description: 'Detailed steps to reproduce the issue' })
    fireEvent.click(screen.getByText('Login button broken').closest('button')!)
    fireEvent.click(screen.getByText('Delete Bug'))

    expect(screen.getByText('Delete?')).toBeInTheDocument()
  })
})
