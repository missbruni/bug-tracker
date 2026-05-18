import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

type Severity = 'critical' | 'high' | 'low'

const state = {
  bugRows: [] as Array<{ id: string; title: string; severity: Severity }>,
  insertedBugs: [] as Record<string, unknown>[],
  updatedBugs: [] as Record<string, unknown>[],
}

mock.module('../../supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bugs') {
        return {
          select: () => ({
            ilike: () => ({
              limit: () => ({ data: state.bugRows }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            state.insertedBugs.push(payload)
            return { error: null }
          },
          update: (payload: Record<string, unknown>) => ({
            eq: () => {
              state.updatedBugs.push(payload)
              return { error: null }
            },
          }),
        }
      }

      if (table === 'testers') {
        return {
          select: () => ({
            ilike: () => ({
              limit: () => ({ data: [] }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          ilike: () => ({
            limit: () => ({ data: [] }),
          }),
        }),
        insert: () => ({ error: null }),
        update: () => ({ eq: () => ({ error: null }) }),
      }
    },
  },
}))

mock.module('../aiParsers', () => ({
  generateBugId: async (severity: Severity) => {
    if (severity === 'critical') return 'CRT-77'
    if (severity === 'high') return 'HI-77'
    return 'LO-77'
  },
}))

let executeSessionActionWithSession: typeof import('../aiSessionActions').executeSessionActionWithSession

beforeAll(async () => {
  ;({ executeSessionActionWithSession } = await import('../aiSessionActions'))
})

beforeEach(() => {
  state.bugRows = []
  state.insertedBugs = []
  state.updatedBugs = []
})

describe('executeSessionActionWithSession bug actions', () => {
  test('create_bug creates a bug directly with defaults', async () => {
    const result = await executeSessionActionWithSession(
      {
        action: 'create_bug',
        title: 'Checkout button unresponsive',
        description: 'Clicking checkout does nothing',
        severity: 'critical',
      },
      { sessionId: null, onSessionCreated: () => {}, activeTeamId: null, pinRole: 'team' },
    )

    expect(result.success).toBe(true)
    expect(state.insertedBugs).toHaveLength(1)
    expect(state.insertedBugs[0]).toMatchObject({
      id: 'CRT-77',
      title: 'Checkout button unresponsive',
      severity: 'critical',
      tester: 'Unknown',
      device: '—',
      page: '—',
      reviewed: false,
    })
  })

  test('edit_bug syncs title prefix when severity changes', async () => {
    state.bugRows = [{ id: 'HI-03', title: 'HI Login crash', severity: 'high' }]

    const result = await executeSessionActionWithSession(
      { action: 'edit_bug', bug: 'HI-03', severity: 'critical' },
      { sessionId: null, onSessionCreated: () => {}, activeTeamId: null, pinRole: 'team' },
    )

    expect(result.success).toBe(true)
    expect(state.updatedBugs).toHaveLength(1)
    expect(state.updatedBugs[0]).toMatchObject({
      severity: 'critical',
      title: 'CRT Login crash',
    })
  })

  test('edit_bug keeps title unchanged when no prefix exists', async () => {
    state.bugRows = [{ id: 'HI-04', title: 'Login crash', severity: 'high' }]

    const result = await executeSessionActionWithSession(
      { action: 'edit_bug', bug: 'HI-04', severity: 'critical' },
      { sessionId: null, onSessionCreated: () => {}, activeTeamId: null, pinRole: 'team' },
    )

    expect(result.success).toBe(true)
    expect(state.updatedBugs).toHaveLength(1)
    expect(state.updatedBugs[0]).toMatchObject({
      severity: 'critical',
      title: 'Login crash',
    })
  })
})
