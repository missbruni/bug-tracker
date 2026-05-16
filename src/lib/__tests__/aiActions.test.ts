import { test, expect, describe } from 'bun:test'
import { parseSessionActions, parseBugsFromResponse, stripJsonBlock } from '../aiParsers'
import { buildSystemPrompt } from '../aiPrompt'

describe('parseSessionActions — new action types', () => {
  test('parses edit_bug action', () => {
    const text = 'Sure, I\'ll update that.\n```session_action\n{"action":"edit_bug","bug":"HI-03","severity":"critical"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('edit_bug')
    expect(actions[0].bug).toBe('HI-03')
    expect(actions[0].severity).toBe('critical')
  })

  test('parses resolve_bug action', () => {
    const text = '```session_action\n{"action":"resolve_bug","bug":"the login crash"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('resolve_bug')
    expect(actions[0].bug).toBe('the login crash')
  })

  test('parses reopen_bug action', () => {
    const text = '```session_action\n{"action":"reopen_bug","bug":"HI-05"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('reopen_bug')
  })

  test('parses delete_bug action', () => {
    const text = '```session_action\n{"action":"delete_bug","bug":"LO-01"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('delete_bug')
    expect(actions[0].bug).toBe('LO-01')
  })

  test('parses add_comment action', () => {
    const text = '```session_action\n{"action":"add_comment","bug":"HI-01","comment":"Reproduces on Firefox"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('add_comment')
    expect(actions[0].bug).toBe('HI-01')
    expect(actions[0].comment).toBe('Reproduces on Firefox')
  })

  test('parses add_scenario action', () => {
    const text = '```session_action\n{"action":"add_scenario","letter":"D","title":"Login flow","description":"Test SSO","device_requirement":"Mobile"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('add_scenario')
    expect(actions[0].letter).toBe('D')
    expect(actions[0].title).toBe('Login flow')
    expect(actions[0].description).toBe('Test SSO')
    expect(actions[0].device_requirement).toBe('Mobile')
  })

  test('parses edit_scenario action', () => {
    const text = '```session_action\n{"action":"edit_scenario","letter":"A","title":"New title"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('edit_scenario')
    expect(actions[0].letter).toBe('A')
    expect(actions[0].title).toBe('New title')
  })

  test('parses set_session_status action', () => {
    const text = '```session_action\n{"action":"set_session_status","name":"Sprint 5","status":"active"}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('set_session_status')
    expect(actions[0].name).toBe('Sprint 5')
    expect(actions[0].status).toBe('active')
  })

  test('parses edit_tester action', () => {
    const text = '```session_action\n{"action":"edit_tester","tester":"Bruna","name":"Bruna Lima","devices":["Desktop Chrome","iPhone Safari"]}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('edit_tester')
    expect(actions[0].tester).toBe('Bruna')
    expect(actions[0].name).toBe('Bruna Lima')
    expect(actions[0].devices).toEqual(['Desktop Chrome', 'iPhone Safari'])
  })

  test('parses set_bug_filters action', () => {
    const text = '```session_action\n{"action":"set_bug_filters","severity":"critical","severities":["high","low"],"tester":"Bruna","date":"7d","session":"Sprint 5","sort":"newest","search":"payment","clear":false}\n```'
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('set_bug_filters')
    expect(actions[0].severity).toBe('critical')
    expect(actions[0].severities).toEqual(['high', 'low'])
    expect(actions[0].tester).toBe('Bruna')
    expect(actions[0].date).toBe('7d')
    expect(actions[0].session).toBe('Sprint 5')
    expect(actions[0].sort).toBe('newest')
    expect(actions[0].search).toBe('payment')
    expect(actions[0].clear).toBe(false)
  })

  test('parses multiple actions in one response', () => {
    const text = `I'll resolve those two bugs.
\`\`\`session_action
{"action":"resolve_bug","bug":"HI-01"}
\`\`\`
\`\`\`session_action
{"action":"resolve_bug","bug":"HI-02"}
\`\`\``
    const actions = parseSessionActions(text)
    expect(actions).toHaveLength(2)
    expect(actions[0].bug).toBe('HI-01')
    expect(actions[1].bug).toBe('HI-02')
  })
})

describe('stripJsonBlock', () => {
  test('strips session_action blocks from response', () => {
    const text = 'Done!\n```session_action\n{"action":"resolve_bug","bug":"HI-01"}\n```\nAnything else?'
    const result = stripJsonBlock(text)
    expect(result).toContain('Done!')
    expect(result).toContain('Anything else?')
    expect(result).not.toContain('session_action')
  })
})

describe('buildSystemPrompt', () => {
  test('includes bug management instructions', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('edit_bug')
    expect(prompt).toContain('resolve_bug')
    expect(prompt).toContain('reopen_bug')
    expect(prompt).toContain('delete_bug')
    expect(prompt).toContain('add_comment')
    expect(prompt).toContain('add_scenario')
    expect(prompt).toContain('edit_scenario')
    expect(prompt).toContain('set_session_status')
    expect(prompt).toContain('edit_tester')
    expect(prompt).toContain('set_bug_filters')
    expect(prompt).toContain('severities')
  })

  test('appends context when provided', () => {
    const prompt = buildSystemPrompt('Active bugs (3):\nHI-01: Button bug')
    expect(prompt).toContain('CURRENT CONTEXT')
    expect(prompt).toContain('HI-01: Button bug')
  })
})
