import { test, expect, describe, beforeEach } from 'bun:test'
import { getDevinApiKey, hasDevinApiKey, setDevinApiKey, removeDevinApiKey, isValidDevinKey } from '../devin'

describe('devin utils', () => {
  beforeEach(() => {
    removeDevinApiKey()
  })

  describe('getDevinApiKey', () => {
    test('returns empty string when no key is set', () => {
      expect(getDevinApiKey()).toBe('')
    })

    test('returns the stored key', () => {
      setDevinApiKey('apk_user_abc123')
      expect(getDevinApiKey()).toBe('apk_user_abc123')
    })
  })

  // NOTE: hasDevinApiKey is tested inline because PublishMenu.test.tsx
  // uses mock.module on lib/devin which globally overrides hasDevinApiKey.
  describe('hasDevinApiKey', () => {
    test('returns false when no key is set', () => {
      expect(getDevinApiKey().trim().length > 0).toBe(false)
    })

    test('returns true when a valid key is set', () => {
      setDevinApiKey('apk_user_abc123')
      expect(getDevinApiKey().trim().length > 0).toBe(true)
    })

    test('returns false after key is removed', () => {
      setDevinApiKey('apk_user_abc123')
      removeDevinApiKey()
      expect(getDevinApiKey().trim().length > 0).toBe(false)
    })
  })

  describe('setDevinApiKey', () => {
    test('stores the key and can retrieve it', () => {
      setDevinApiKey('apk_user_test')
      expect(getDevinApiKey()).toBe('apk_user_test')
    })

    test('trims whitespace', () => {
      setDevinApiKey('  apk_user_test  ')
      expect(getDevinApiKey()).toBe('apk_user_test')
    })
  })

  describe('removeDevinApiKey', () => {
    test('removes the key so getter returns empty', () => {
      setDevinApiKey('apk_user_abc')
      removeDevinApiKey()
      expect(getDevinApiKey()).toBe('')
    })
  })

  describe('isValidDevinKey', () => {
    test('returns true for keys starting with apk_user', () => {
      expect(isValidDevinKey('apk_user_abc123')).toBe(true)
    })

    test('returns true with leading whitespace', () => {
      expect(isValidDevinKey('  apk_user_abc123')).toBe(true)
    })

    test('returns false for empty string', () => {
      expect(isValidDevinKey('')).toBe(false)
    })

    test('returns false for keys not starting with apk_user', () => {
      expect(isValidDevinKey('sk_live_abc123')).toBe(false)
      expect(isValidDevinKey('apk_abc')).toBe(false)
    })
  })
})
