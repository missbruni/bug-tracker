/// <reference lib="dom" />
import { test, expect, describe, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SecondaryAppBar from '../SecondaryAppBar'

afterEach(() => cleanup())

describe('SecondaryAppBar', () => {
  test('renders description and stats', () => {
    render(
      <SecondaryAppBar
        description="Test description"
        stats={<span>5 active / 10 total</span>}
        search=""
        onSearchChange={() => {}}
      />
    )
    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByText('5 active / 10 total')).toBeInTheDocument()
  })

  test('renders search input with placeholder', () => {
    render(
      <SecondaryAppBar
        description="Desc"
        stats="Stats"
        search=""
        onSearchChange={() => {}}
        searchPlaceholder="Search items..."
      />
    )
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument()
  })

  test('calls onSearchChange when typing', () => {
    let value = ''
    render(
      <SecondaryAppBar
        description="Desc"
        stats="Stats"
        search={value}
        onSearchChange={(v) => { value = v }}
        searchPlaceholder="Search..."
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'hello' } })
    expect(value).toBe('hello')
  })

  test('renders action button', () => {
    render(
      <SecondaryAppBar
        description="Desc"
        stats="Stats"
        search=""
        onSearchChange={() => {}}
        actionButton={<button data-testid="action-btn">Add</button>}
      />
    )
    expect(screen.getByTestId('action-btn')).toBeInTheDocument()
  })

  test('shows keyboard shortcut when showSearchShortcut is true', () => {
    render(
      <SecondaryAppBar
        description="Desc"
        stats="Stats"
        search=""
        onSearchChange={() => {}}
        showSearchShortcut
      />
    )
    expect(screen.getByText('⌘ K')).toBeInTheDocument()
  })

  test('hides keyboard shortcut by default', () => {
    render(
      <SecondaryAppBar
        description="Desc"
        stats="Stats"
        search=""
        onSearchChange={() => {}}
      />
    )
    expect(screen.queryByText('⌘ K')).not.toBeInTheDocument()
  })
})
