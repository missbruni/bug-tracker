/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import BugEditForm from '../BugEditForm'
import type { Severity } from '../../constants'

afterEach(() => cleanup())

const initial = {
  title: 'Original title',
  description: 'Some desc',
  severity: 'high' as Severity,
  tester: 'Alice',
  device: 'Chrome',
  page: '/home',
  category: 'UI',
}

describe('BugEditForm', () => {
  test('renders all fields with initial values', () => {
    render(<BugEditForm initial={initial} onSave={async () => true} onCancel={() => {}} />)
    expect(screen.getByPlaceholderText('Title *')).toHaveValue('Original title')
    expect(screen.getByPlaceholderText('Tester')).toHaveValue('Alice')
    expect(screen.getByPlaceholderText('Device')).toHaveValue('Chrome')
    expect(screen.getByPlaceholderText('Page')).toHaveValue('/home')
    expect(screen.getByPlaceholderText('Category')).toHaveValue('UI')
    expect(screen.getByPlaceholderText('Description')).toHaveValue('Some desc')
  })

  test('renders severity buttons', () => {
    render(<BugEditForm initial={initial} onSave={async () => true} onCancel={() => {}} />)
    expect(screen.getByText('critical')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
  })

  test('save button is disabled when title is empty', () => {
    render(<BugEditForm initial={{ ...initial, title: '' }} onSave={async () => true} onCancel={() => {}} />)
    expect(screen.getByText('Save')).toBeDisabled()
  })

  test('save button is enabled when title has value', () => {
    render(<BugEditForm initial={initial} onSave={async () => true} onCancel={() => {}} />)
    expect(screen.getByText('Save')).not.toBeDisabled()
  })

  test('calls onCancel when cancel is clicked', () => {
    const onCancel = mock(() => {})
    render(<BugEditForm initial={initial} onSave={async () => true} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('calls onSave with current field values', async () => {
    const onSave = mock(async () => true)
    render(<BugEditForm initial={initial} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Title *'), { target: { value: 'Updated title' } })
    fireEvent.click(screen.getByText('Save'))
    // Wait for async save
    await new Promise(r => setTimeout(r, 10))
    expect(onSave).toHaveBeenCalledTimes(1)
    const savedFields = onSave.mock.calls[0][0] as typeof initial
    expect(savedFields.title).toBe('Updated title')
    expect(savedFields.tester).toBe('Alice')
  })

  test('updates field values on change', () => {
    render(<BugEditForm initial={initial} onSave={async () => true} onCancel={() => {}} />)
    const testerInput = screen.getByPlaceholderText('Tester')
    fireEvent.change(testerInput, { target: { value: 'Bob' } })
    expect(testerInput).toHaveValue('Bob')
  })
})
