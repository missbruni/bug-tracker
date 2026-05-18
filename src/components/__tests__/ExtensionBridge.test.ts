import { test, expect, describe } from 'bun:test'
import { normalizeHostname, extractDomainFromLink } from '../ExtensionBridge'

describe('normalizeHostname', () => {
  test('lowercases and trims', () => {
    expect(normalizeHostname('  Example.COM  ')).toBe('example.com')
  })

  test('strips www prefix', () => {
    expect(normalizeHostname('www.example.com')).toBe('example.com')
  })

  test('does not strip non-www subdomains', () => {
    expect(normalizeHostname('app.example.com')).toBe('app.example.com')
  })
})

describe('extractDomainFromLink', () => {
  test('extracts hostname from full https URL', () => {
    expect(extractDomainFromLink('https://app.example.com/OBMNG')).toBe('app.example.com')
  })

  test('extracts hostname from full http URL', () => {
    expect(extractDomainFromLink('http://staging.example.com:8080/path')).toBe('staging.example.com')
  })

  test('extracts hostname from URL without scheme', () => {
    expect(extractDomainFromLink('example.com/some/path')).toBe('example.com')
  })

  test('strips www from extracted hostname', () => {
    expect(extractDomainFromLink('https://www.example.com/page')).toBe('example.com')
  })

  test('ignores path, query, and fragment', () => {
    expect(extractDomainFromLink('https://app.example.com/OBMNG?q=1#section')).toBe('app.example.com')
  })

  test('returns null for empty string', () => {
    expect(extractDomainFromLink('')).toBeNull()
  })

  test('returns null for whitespace-only string', () => {
    expect(extractDomainFromLink('   ')).toBeNull()
  })

  test('domain with path registers the same as domain without path', () => {
    const withPath = extractDomainFromLink('https://myapp.com/OBMNG')
    const withoutPath = extractDomainFromLink('https://myapp.com')
    expect(withPath).toBe(withoutPath)
    expect(withPath).toBe('myapp.com')
  })
})
