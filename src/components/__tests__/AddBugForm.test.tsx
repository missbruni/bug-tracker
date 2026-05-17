/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ComponentProps } from 'react'
import AddBugForm from '../AddBugForm'
import type { Severity } from '../../constants'

beforeEach(() => {
  localStorage.removeItem('lastTesterId')
  localStorage.removeItem('lastTesterName')
})

afterEach(() => {
  cleanup()
  localStorage.removeItem('lastTesterId')
  localStorage.removeItem('lastTesterName')
})

const nextIds: Record<Severity, number> = { critical: 1, high: 1, low: 1 }
const testers = [
  { id: 't1', name: 'Bruna Lima' },
  { id: 't2', name: 'Denisa Buftea' },
]

function renderForm(overrides?: Partial<ComponentProps<typeof AddBugForm>>) {
  return render(
    <AddBugForm
      onAdd={async () => {}}
      onAddTester={async () => null}
      onCancel={() => {}}
      nextIds={nextIds}
      testers={testers}
      {...overrides}
    />,
  )
}

describe('AddBugForm', () => {
  test('renders title and description fields', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Bug title *')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument()
  })

  test('renders all input fields', () => {
    renderForm()
    expect(screen.getByRole('option', { name: 'Bruna Lima' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '+ Add new tester' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Device / Browser')).toBeInTheDocument()
    // Page is now a select dropdown with page options
    expect(screen.getByRole('option', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Category (optional)')).toBeInTheDocument()
  })

  test('renders severity buttons', () => {
    renderForm()
    expect(screen.getByText('critical')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
  })

  test('Add Bug button is disabled when title is empty', () => {
    renderForm()
    expect(screen.getByText('Add Bug')).toBeInTheDocument()
    // Button should be visually disabled (class-based, not HTML disabled attr)
    const btn = screen.getByText('Add Bug')
    expect(btn.closest('button')?.className).toContain('bg-slate-400')
  })

  test('Add Bug button is enabled when title has value', () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText('Bug title *'), { target: { value: 'A real bug' } })
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    const btn = screen.getByText('Add Bug')
    expect(btn.closest('button')?.className).toContain('bg-blue-500')
  })

  test('calls onCancel when Cancel is clicked', () => {
    const onCancel = mock(() => {})
    renderForm({ onCancel })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('renders session dropdown when sessions are provided', () => {
    renderForm({ sessions: [{ id: 's1', name: 'Sprint 1', status: 'active' }] })
    expect(screen.getByText('Sprint 1 (active)')).toBeInTheDocument()
  })

  test('does not render session dropdown when no sessions', () => {
    renderForm()
    expect(screen.queryByText('No session')).not.toBeInTheDocument()
  })

  test('renders Attach files button', () => {
    renderForm()
    expect(screen.getByText('Attach files')).toBeInTheDocument()
  })

  test('pre-selects tester from localStorage', () => {
    localStorage.setItem('lastTesterId', 't2')
    renderForm()
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    expect(select.value).toBe('t2')
  })

  test('saves tester to localStorage on submit', async () => {
    const onAdd = mock(async () => {})
    renderForm({ onAdd })
    fireEvent.change(screen.getByPlaceholderText('Bug title *'), { target: { value: 'Test bug' } })
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    fireEvent.click(screen.getByText('Add Bug'))
    // Wait for async submit
    await new Promise(r => setTimeout(r, 50))
    expect(localStorage.getItem('lastTesterId')).toBe('t1')
    expect(localStorage.getItem('lastTesterName')).toBe('Bruna Lima')
  })
})
