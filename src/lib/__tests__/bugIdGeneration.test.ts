import { describe, expect, test } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { incrementBugId, insertBugWithRetry } from '../../domains/bugs/id'

describe('incrementBugId', () => {
  test('increments a standard bug ID', () => {
    expect(incrementBugId('HI-01')).toBe('HI-02')
    expect(incrementBugId('HI-09')).toBe('HI-10')
    expect(incrementBugId('HI-99')).toBe('HI-100')
  })

  test('increments CRT prefix', () => {
    expect(incrementBugId('CRT-01')).toBe('CRT-02')
    expect(incrementBugId('CRT-99')).toBe('CRT-100')
  })

  test('increments LO prefix', () => {
    expect(incrementBugId('LO-05')).toBe('LO-06')
  })

  test('preserves zero-padding width', () => {
    expect(incrementBugId('HI-001')).toBe('HI-002')
    expect(incrementBugId('HI-009')).toBe('HI-010')
  })

  test('handles IDs without a dash separator', () => {
    expect(incrementBugId('NODASH')).toBe('NODASH-1')
  })
})

describe('insertBugWithRetry', () => {
  function makeMockSupabase(insertResults: Array<{ error: { code: string; message: string } | null }>) {
    let callIndex = 0
    return {
      from: () => ({
        insert: async () => {
          const result = insertResults[callIndex] ?? { error: null }
          callIndex++
          return result
        },
      }),
    }
  }

  test('returns startId on first successful insert', async () => {
    const sb = makeMockSupabase([{ error: null }])
    const result = await insertBugWithRetry(sb as unknown as SupabaseClient, { id: 'HI-05' }, 'HI-05')
    expect(result).toBe('HI-05')
  })

  test('retries on duplicate key (23505) and increments ID', async () => {
    const sb = makeMockSupabase([
      { error: { code: '23505', message: 'duplicate key' } },
      { error: { code: '23505', message: 'duplicate key' } },
      { error: null },
    ])
    const bugData: Record<string, unknown> = { id: 'HI-01' }
    const result = await insertBugWithRetry(sb as unknown as SupabaseClient, bugData, 'HI-01')
    expect(result).toBe('HI-03')
  })

  test('throws on non-duplicate errors', async () => {
    const sb = makeMockSupabase([
      { error: { code: '42501', message: 'permission denied' } },
    ])
    await expect(insertBugWithRetry(sb as unknown as SupabaseClient, { id: 'HI-01' }, 'HI-01')).rejects.toThrow('permission denied')
  })

  test('throws after exhausting retries', async () => {
    const errors = Array.from({ length: 51 }, () => ({
      error: { code: '23505', message: 'duplicate key' },
    }))
    const sb = makeMockSupabase(errors)
    await expect(insertBugWithRetry(sb as unknown as SupabaseClient, { id: 'HI-01' }, 'HI-01')).rejects.toThrow('multiple ID retries')
  })
})
