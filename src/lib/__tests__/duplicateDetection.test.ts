import { describe, test, expect } from 'bun:test'
import { findPotentialDuplicates } from '../duplicateDetection'
import type { Bug } from '../../types'

const makeBug = (overrides: Partial<Bug> = {}): Bug => ({
  id: 'HI-1',
  title: 'Test bug',
  description: '',
  severity: 'high',
  tester: 'Alice',
  device: 'Chrome',
  page: 'Home',
  category: null,
  comments: [],
  attachments: [],
  ...overrides,
})

const existingBugs: Bug[] = [
  makeBug({ id: 'CRT-1', title: 'Payment page crashes on submit', description: 'The payment form throws an error' }),
  makeBug({ id: 'HI-2', title: 'Login button not visible on mobile', description: 'The login button is hidden' }),
  makeBug({ id: 'HI-3', title: 'Summary page shows wrong total', description: 'Total calculation is incorrect' }),
  makeBug({ id: 'LO-1', title: 'Typo in confirmation email text' }),
  makeBug({ id: 'HI-4', title: 'Payment form validation error on expiry date' }),
]

describe('findPotentialDuplicates', () => {
  test('returns empty for short queries', () => {
    expect(findPotentialDuplicates('pay', existingBugs)).toEqual([])
  })

  test('returns empty for empty query', () => {
    expect(findPotentialDuplicates('', existingBugs)).toEqual([])
  })

  test('finds duplicates for similar title', () => {
    const results = findPotentialDuplicates('payment page crash', existingBugs)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].bug.id).toBe('CRT-1')
  })

  test('finds duplicates via partial word matches', () => {
    const results = findPotentialDuplicates('payment form error', existingBugs)
    expect(results.length).toBeGreaterThan(0)
    const matchedIds = results.map((result) => result.bug.id)
    expect(matchedIds).toContain('HI-4')
  })

  test('returns empty for unrelated query', () => {
    const results = findPotentialDuplicates('database migration timeout', existingBugs)
    expect(results.length).toBe(0)
  })

  test('respects maxResults limit', () => {
    const results = findPotentialDuplicates('payment', existingBugs, 1)
    expect(results.length).toBeLessThanOrEqual(1)
  })

  test('results are sorted by score descending', () => {
    const results = findPotentialDuplicates('payment page', existingBugs)
    for (let index = 1; index < results.length; index++) {
      expect(results[index - 1].score).toBeGreaterThanOrEqual(results[index].score)
    }
  })

  test('returns empty when no existing bugs', () => {
    expect(findPotentialDuplicates('payment page crash', [])).toEqual([])
  })
})
