import { describe, expect, test } from 'bun:test'
import { buildBugBacklogDescription, buildBugBacklogSnapshot, mapSeverityToBacklogPriority, normalizeBacklogKey } from '../helpers'
import type { Bug } from '../../bugs/model'

const bug: Bug = {
  id: 'HI-03',
  title: 'Checkout button fails',
  description: 'Clicking checkout does nothing.',
  severity: 'high',
  tester: 'Bruna',
  device: 'iPhone Safari',
  page: 'Checkout',
  category: 'UI',
  comments: [{ id: 1, text: 'Still happens after refresh.', time: 'Today' }],
  attachments: [{ id: 2, name: 'screen.png', url: 'https://example.com/screen.png', type: 'image/png' }],
}

describe('backlog helpers', () => {
  test('maps bug severity into product priority', () => {
    expect(mapSeverityToBacklogPriority('critical')).toBe('urgent')
    expect(mapSeverityToBacklogPriority('high')).toBe('high')
    expect(mapSeverityToBacklogPriority('low')).toBe('low')
  })

  test('normalizes team backlog keys', () => {
    expect(normalizeBacklogKey('mobile qa')).toBe('MOBILEQA')
    expect(normalizeBacklogKey('team-with-a-long-name')).toBe('TEAMWITHALON')
    expect(normalizeBacklogKey('')).toBe('TEAM')
  })

  test('builds a source bug description snapshot for backlog conversion', () => {
    const description = buildBugBacklogDescription(bug)

    expect(description).toContain('Clicking checkout does nothing.')
    expect(description).toContain('Source bug: HI-03')
    expect(description).toContain('- Still happens after refresh. (Today)')
    expect(description).toContain('- screen.png: https://example.com/screen.png')
  })

  test('builds structured bug conversion metadata', () => {
    const snapshot = buildBugBacklogSnapshot(bug)

    expect(snapshot.bug_id).toBe('HI-03')
    expect(snapshot.severity).toBe('high')
    expect(snapshot.comments).toEqual([{ id: 1, text: 'Still happens after refresh.', time: 'Today' }])
  })
})
