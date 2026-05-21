import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { buildBugPermalink, copyToClipboard } from '../bugPermalink'

describe('buildBugPermalink', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  test('builds a URL with ?q= set to the bug id', () => {
    const url = buildBugPermalink('CRT-12')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('q')).toBe('CRT-12')
  })

  test('strips existing filters and hash from the URL', () => {
    window.history.replaceState(null, '', '/?severity=high&tester=Alice#old')
    const url = buildBugPermalink('HI-01')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('q')).toBe('HI-01')
    expect(parsed.searchParams.has('severity')).toBe(false)
    expect(parsed.hash).toBe('')
  })
})

describe('copyToClipboard', () => {
  function mockClipboard(writeText: typeof navigator.clipboard.writeText) {
    const proto = Object.getPrototypeOf(navigator)
    Object.defineProperty(proto, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })
  }

  test('returns true when clipboard write succeeds', async () => {
    mockClipboard(mock(() => Promise.resolve()))
    const result = await copyToClipboard('hello')
    expect(result).toBe(true)
  })

  test('returns false when clipboard write fails', async () => {
    mockClipboard(mock(() => Promise.reject(new Error('denied'))))
    const result = await copyToClipboard('hello')
    expect(result).toBe(false)
  })
})
