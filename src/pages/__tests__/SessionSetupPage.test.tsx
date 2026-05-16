/// <reference lib="dom" />
import { test, expect, describe, afterEach } from 'bun:test'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

afterEach(() => cleanup())

// ─── Inline Title Edit ──────────────────────────────────────

function InlineTitle({ name, isCompleted, onSave }: { name: string; isCompleted: boolean; onSave: (n: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  const save = () => {
    const trimmed = value.trim()
    if (trimmed) onSave(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        data-testid="title-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={save}
        autoFocus
      />
    )
  }

  return (
    <h1
      data-testid="title-display"
      onClick={() => { if (!isCompleted) { setValue(name); setEditing(true) } }}
      style={{ cursor: isCompleted ? 'default' : 'pointer' }}
      title={isCompleted ? '' : 'Click to edit title'}
    >
      {name}
    </h1>
  )
}

describe('Inline Title Edit', () => {
  test('renders title text', () => {
    render(<InlineTitle name="My Session" isCompleted={false} onSave={() => {}} />)
    expect(screen.getByTestId('title-display')).toHaveTextContent('My Session')
  })

  test('clicking title enters edit mode', () => {
    render(<InlineTitle name="My Session" isCompleted={false} onSave={() => {}} />)
    fireEvent.click(screen.getByTestId('title-display'))
    expect(screen.getByTestId('title-input')).toBeInTheDocument()
    expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('My Session')
  })

  test('does not enter edit mode when completed', () => {
    render(<InlineTitle name="Done Session" isCompleted={true} onSave={() => {}} />)
    fireEvent.click(screen.getByTestId('title-display'))
    expect(screen.queryByTestId('title-input')).toBeNull()
  })

  test('pressing Enter saves and exits edit mode', () => {
    let saved = ''
    render(<InlineTitle name="Old Name" isCompleted={false} onSave={n => { saved = n }} />)
    fireEvent.click(screen.getByTestId('title-display'))
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'New Name' } })
    fireEvent.keyDown(screen.getByTestId('title-input'), { key: 'Enter' })
    expect(saved).toBe('New Name')
    expect(screen.getByTestId('title-display')).toBeInTheDocument()
  })

  test('pressing Escape cancels without saving', () => {
    let saved = ''
    render(<InlineTitle name="Original" isCompleted={false} onSave={n => { saved = n }} />)
    fireEvent.click(screen.getByTestId('title-display'))
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'Changed' } })
    fireEvent.keyDown(screen.getByTestId('title-input'), { key: 'Escape' })
    expect(saved).toBe('')
    expect(screen.getByTestId('title-display')).toBeInTheDocument()
  })

  test('blur saves the value', () => {
    let saved = ''
    render(<InlineTitle name="Before" isCompleted={false} onSave={n => { saved = n }} />)
    fireEvent.click(screen.getByTestId('title-display'))
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'After' } })
    fireEvent.blur(screen.getByTestId('title-input'))
    expect(saved).toBe('After')
  })

  test('shows tooltip on non-completed sessions', () => {
    render(<InlineTitle name="Hoverable" isCompleted={false} onSave={() => {}} />)
    expect(screen.getByTestId('title-display').title).toBe('Click to edit title')
  })

  test('no tooltip on completed sessions', () => {
    render(<InlineTitle name="Done" isCompleted={true} onSave={() => {}} />)
    expect(screen.getByTestId('title-display').title).toBe('')
  })
})

// ─── Session Not Found Alert ────────────────────────────────

function SessionNotFound() {
  return (
    <div data-testid="not-found-alert" className="rounded-xl border border-red-200">
      <h2>Session not found</h2>
      <p>This session may have been deleted or the link is invalid.</p>
      <a href="/sessions">← Back to Sessions</a>
    </div>
  )
}

describe('Session Not Found Alert', () => {
  test('renders heading', () => {
    render(<MemoryRouter><SessionNotFound /></MemoryRouter>)
    expect(screen.getByText('Session not found')).toBeInTheDocument()
  })

  test('renders explanation text', () => {
    render(<MemoryRouter><SessionNotFound /></MemoryRouter>)
    expect(screen.getByText(/deleted or the link is invalid/)).toBeInTheDocument()
  })

  test('renders back link', () => {
    render(<MemoryRouter><SessionNotFound /></MemoryRouter>)
    const link = screen.getByText('← Back to Sessions')
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/sessions')
  })
})
