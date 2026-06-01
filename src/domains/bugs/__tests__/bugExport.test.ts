import { describe, test, expect } from 'bun:test'
import { bugsToCSV, bugsToJSON } from '../export'
import type { Bug } from '../model'

const makeBug = (overrides: Partial<Bug> = {}): Bug => ({
  id: 'HI-1',
  title: 'Test bug',
  description: 'A description',
  severity: 'high',
  tester: 'Alice',
  device: 'Chrome',
  page: 'Home',
  category: 'UI',
  created_at: '2026-05-27T00:00:00Z',
  reviewed: false,
  backlog_url: null,
  devin_url: null,
  session_id: null,
  comments: [],
  attachments: [],
  ...overrides,
})

describe('bugsToCSV', () => {
  test('produces header row plus one data row', () => {
    const csv = bugsToCSV([makeBug()])
    const lines = csv.split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toBe(
      'ID,Title,Description,Severity,Status,Tester,Device,Page,Category,Created At,Comments,Attachments,Backlog URL,Session ID',
    )
  })

  test('reviewed bug shows Completed status', () => {
    const csv = bugsToCSV([makeBug({ reviewed: true })])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('Completed')
  })

  test('active bug shows Active status', () => {
    const csv = bugsToCSV([makeBug({ reviewed: false })])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('Active')
  })

  test('escapes fields with commas', () => {
    const csv = bugsToCSV([makeBug({ title: 'Bug, with comma' })])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('"Bug, with comma"')
  })

  test('escapes fields with double quotes', () => {
    const csv = bugsToCSV([makeBug({ title: 'Bug "quoted"' })])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('"Bug ""quoted"""')
  })

  test('includes comment and attachment counts', () => {
    const csv = bugsToCSV([
      makeBug({
        comments: [
          { text: 'first', time: 'now' },
          { text: 'second', time: 'later' },
        ],
        attachments: [{ name: 'screenshot.png', url: 'https://example.com/img.png', type: 'image/png' }],
      }),
    ])
    const dataRow = csv.split('\n')[1]
    // Comment count = 2, Attachment count = 1
    expect(dataRow).toContain(',2,1,')
  })

  test('empty list returns header only', () => {
    const csv = bugsToCSV([])
    const lines = csv.split('\n')
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('ID')
  })
})

describe('bugsToJSON', () => {
  test('produces valid JSON array', () => {
    const json = bugsToJSON([makeBug()])
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(1)
  })

  test('includes expected fields', () => {
    const json = bugsToJSON([makeBug()])
    const parsed = JSON.parse(json)
    const record = parsed[0]
    expect(record.id).toBe('HI-1')
    expect(record.title).toBe('Test bug')
    expect(record.severity).toBe('high')
    expect(record.status).toBe('Active')
    expect(record.tester).toBe('Alice')
  })

  test('reviewed bug has Completed status', () => {
    const json = bugsToJSON([makeBug({ reviewed: true })])
    const parsed = JSON.parse(json)
    expect(parsed[0].status).toBe('Completed')
  })

  test('empty list returns empty JSON array', () => {
    const json = bugsToJSON([])
    expect(JSON.parse(json)).toEqual([])
  })
})
