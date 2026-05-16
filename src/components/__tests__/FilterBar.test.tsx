/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import FilterBar from '../FilterBar'
import type { Bug, SessionOption } from '../../types'

afterEach(() => cleanup())

const makeBug = (overrides: Partial<Bug> = {}): Bug => ({
  id: 'HI-01',
  title: 'Test',
  description: '',
  severity: 'high',
  tester: 'Alice',
  device: 'Chrome',
  page: '/',
  category: null,
  reviewed: false,
  comments: [],
  attachments: [],
  ...overrides,
})

const defaultProps = () => ({
  bugs: [makeBug(), makeBug({ id: 'CRT-01', severity: 'critical' }), makeBug({ id: 'LO-01', severity: 'low', reviewed: true })],
  activeBugs: [makeBug(), makeBug({ id: 'CRT-01', severity: 'critical' })],
  counts: { critical: 1, high: 1, low: 0 } as Record<'critical' | 'high' | 'low', number>,
  severityFilter: 'all',
  setSeverityFilter: mock(() => {}),
  testerFilter: 'all',
  setTesterFilter: mock(() => {}),
  dateFilter: 'all',
  setDateFilter: mock(() => {}),
  sessionFilter: 'all',
  setSessionFilter: mock(() => {}),
  sortOrder: 'default',
  setSortOrder: mock(() => {}),
  testers: ['Alice', 'Bob'],
  sessions: [] as SessionOption[],
})

describe('FilterBar', () => {
  test('renders severity filter buttons with counts', () => {
    render(<FilterBar {...defaultProps()} />)
    expect(screen.getByText('Active (2)')).toBeInTheDocument()
    expect(screen.getByText('Critical (1)')).toBeInTheDocument()
    expect(screen.getByText('High (1)')).toBeInTheDocument()
    expect(screen.getByText('Low (0)')).toBeInTheDocument()
    expect(screen.getByText('Completed (1)')).toBeInTheDocument()
  })

  test('calls setSeverityFilter when a filter button is clicked', () => {
    const props = defaultProps()
    render(<FilterBar {...props} />)
    fireEvent.click(screen.getByText('Critical (1)'))
    expect(props.setSeverityFilter).toHaveBeenCalledWith('critical')
  })

  test('shows multiple active severity chips when severityFilter has multiple values', () => {
    const props = defaultProps()
    props.severityFilter = 'high,low'
    render(<FilterBar {...props} />)

    expect(screen.getByText('High (1)').className).toContain('bg-slate-900')
    expect(screen.getByText('Low (0)').className).toContain('bg-slate-900')
    expect(screen.getByText('Active (2)').className).not.toContain('bg-slate-900')
  })

  test('renders tester dropdown with options', () => {
    render(<FilterBar {...defaultProps()} />)
    expect(screen.getByText('All testers')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  test('renders date dropdown options', () => {
    render(<FilterBar {...defaultProps()} />)
    expect(screen.getByText('All dates')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
  })

  test('renders session dropdown when sessions exist', () => {
    const props = defaultProps()
    props.sessions = [{ id: 's1', name: 'Sprint 1', status: 'active' }]
    render(<FilterBar {...props} />)
    expect(screen.getByText('All sessions')).toBeInTheDocument()
    expect(screen.getByText('Sprint 1')).toBeInTheDocument()
  })

  test('hides session dropdown when no sessions', () => {
    render(<FilterBar {...defaultProps()} />)
    expect(screen.queryByText('All sessions')).not.toBeInTheDocument()
  })

  test('sort button cycles through sort orders', () => {
    const props = defaultProps()
    render(<FilterBar {...props} />)
    fireEvent.click(screen.getByTitle('Default order'))
    expect(props.setSortOrder).toHaveBeenCalledWith('newest')
  })
})
