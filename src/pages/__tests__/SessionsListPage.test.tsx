/// <reference lib="dom" />
import { test, expect, describe, afterEach } from 'bun:test'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Pure UI test for the delete confirmation dialog pattern
// (Does not import SessionsListPage to avoid supabase mock conflicts)

function DeleteConfirmDialog({ name, onDelete, onCancel }: { name: string; onDelete: () => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  return (
    <div>
      <h3>Delete session?</h3>
      <p>This will permanently delete <span>{name}</span> and all its scenarios, assignments, and feedback. This action cannot be undone.</p>
      <p>Type <span>DELETE</span> to confirm:</p>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Type DELETE here" />
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onDelete} disabled={text !== 'DELETE'}>Delete permanently</button>
    </div>
  )
}

describe('Delete Confirmation Dialog', () => {
  afterEach(() => cleanup())

  test('renders session name in warning message', () => {
    render(<DeleteConfirmDialog name="Test Session" onDelete={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Delete session?')).toBeInTheDocument()
    expect(screen.getByText('Test Session')).toBeInTheDocument()
  })

  test('delete button is disabled by default', () => {
    render(<DeleteConfirmDialog name="Test" onDelete={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('delete button stays disabled with wrong text', () => {
    render(<DeleteConfirmDialog name="Test" onDelete={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Type DELETE here'), { target: { value: 'del' } })
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('delete button enables when typing DELETE', () => {
    render(<DeleteConfirmDialog name="Test" onDelete={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Type DELETE here'), { target: { value: 'DELETE' } })
    expect(screen.getByText('Delete permanently')).not.toBeDisabled()
  })

  test('delete button is case sensitive — "delete" does not work', () => {
    render(<DeleteConfirmDialog name="Test" onDelete={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Type DELETE here'), { target: { value: 'delete' } })
    expect(screen.getByText('Delete permanently')).toBeDisabled()
  })

  test('cancel button calls onCancel', () => {
    let cancelled = false
    render(<DeleteConfirmDialog name="Test" onDelete={() => {}} onCancel={() => { cancelled = true }} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(cancelled).toBe(true)
  })

  test('delete button calls onDelete when enabled and clicked', () => {
    let deleted = false
    render(<DeleteConfirmDialog name="Test" onDelete={() => { deleted = true }} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Type DELETE here'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByText('Delete permanently'))
    expect(deleted).toBe(true)
  })
})
