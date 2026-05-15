/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AddBugForm from '../AddBugForm'
import type { Severity } from '../../constants'

afterEach(() => cleanup())

const nextIds: Record<Severity, number> = { critical: 1, high: 1, low: 1 }

describe('AddBugForm', () => {
  test('renders title and description fields', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    expect(screen.getByPlaceholderText('Bug title *')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument()
  })

  test('renders all input fields', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    expect(screen.getByPlaceholderText('Tester name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Device / Browser')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Page')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Category (optional)')).toBeInTheDocument()
  })

  test('renders severity buttons', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    expect(screen.getByText('critical')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
  })

  test('Add Bug button is disabled when title is empty', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    expect(screen.getByText('Add Bug')).toBeInTheDocument()
    // Button should be visually disabled (style-based, not HTML disabled attr)
    const btn = screen.getByText('Add Bug')
    expect(btn.closest('button')?.style.background).toBe('#94a3b8')
  })

  test('Add Bug button is enabled when title has value', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    fireEvent.change(screen.getByPlaceholderText('Bug title *'), { target: { value: 'A real bug' } })
    const btn = screen.getByText('Add Bug')
    expect(btn.closest('button')?.style.background).toBe('#3b82f6')
  })

  test('calls onCancel when Cancel is clicked', () => {
    const onCancel = mock(() => {})
    render(<AddBugForm onAdd={async () => {}} onCancel={onCancel} nextIds={nextIds} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('renders session dropdown when sessions are provided', () => {
    render(
      <AddBugForm
        onAdd={async () => {}}
        onCancel={() => {}}
        nextIds={nextIds}
        sessions={[{ id: 's1', name: 'Sprint 1', status: 'active' }]}
      />,
    )
    expect(screen.getByText('Sprint 1 (active)')).toBeInTheDocument()
  })

  test('does not render session dropdown when no sessions', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    expect(screen.queryByText('No session')).not.toBeInTheDocument()
  })

  test('renders Attach files button', () => {
    render(<AddBugForm onAdd={async () => {}} onCancel={() => {}} nextIds={nextIds} />)
    expect(screen.getByText('Attach files')).toBeInTheDocument()
  })
})
