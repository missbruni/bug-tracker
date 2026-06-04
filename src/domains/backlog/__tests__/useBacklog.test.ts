import { describe, expect, test } from 'bun:test'
import { calculateInsertSortOrder } from '../useBacklog'
import type { BacklogItem } from '../model'

function item(id: string, columnId: string, sortOrder: number): BacklogItem {
  return {
    id,
    team_id: 'team-1',
    display_id: id,
    sequence_number: Number(id.replace(/\D/g, '')) || 1,
    title: id,
    type: 'task',
    priority: 'medium',
    column_id: columnId,
    sort_order: sortOrder,
    comments: [],
    attachments: [],
    bug_links: [],
    linked_bugs: [],
  }
}

describe('calculateInsertSortOrder', () => {
  test('places first item at default gap', () => {
    expect(calculateInsertSortOrder([], 'ready')).toBe(1000)
  })

  test('places items at the end of a column', () => {
    expect(calculateInsertSortOrder([item('A-1', 'ready', 1000), item('A-2', 'ready', 2000)], 'ready')).toBe(3000)
  })

  test('places items between neighbors when dropped before an item', () => {
    expect(calculateInsertSortOrder([item('A-1', 'ready', 1000), item('A-2', 'ready', 2000)], 'ready', 'A-2')).toBe(1500)
  })

  test('ignores items in other columns', () => {
    expect(calculateInsertSortOrder([item('A-1', 'backlog', 1000), item('A-2', 'ready', 1000)], 'ready')).toBe(2000)
  })
})
