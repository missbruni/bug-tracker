import { test, expect, describe } from 'bun:test'
import { matchesDateFilter } from '../dateFilter'

describe('matchesDateFilter', () => {
  const now = new Date()
  const todayISO = now.toISOString()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(12, 0, 0, 0)
  const yesterdayISO = yesterday.toISOString()

  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const threeDaysAgoISO = threeDaysAgo.toISOString()

  const tenDaysAgo = new Date(now)
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
  const tenDaysAgoISO = tenDaysAgo.toISOString()

  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const sixtyDaysAgoISO = sixtyDaysAgo.toISOString()

  test('filter "all" always returns true', () => {
    expect(matchesDateFilter(todayISO, 'all')).toBe(true)
    expect(matchesDateFilter(sixtyDaysAgoISO, 'all')).toBe(true)
    expect(matchesDateFilter(null, 'all')).toBe(true)
    expect(matchesDateFilter(undefined, 'all')).toBe(true)
  })

  test('returns true when dateString is null or undefined', () => {
    expect(matchesDateFilter(null, 'today')).toBe(true)
    expect(matchesDateFilter(undefined, '7d')).toBe(true)
  })

  test('filter "today" matches only today', () => {
    expect(matchesDateFilter(todayISO, 'today')).toBe(true)
    expect(matchesDateFilter(yesterdayISO, 'today')).toBe(false)
    expect(matchesDateFilter(tenDaysAgoISO, 'today')).toBe(false)
  })

  test('filter "yesterday" matches only yesterday', () => {
    expect(matchesDateFilter(yesterdayISO, 'yesterday')).toBe(true)
    expect(matchesDateFilter(todayISO, 'yesterday')).toBe(false)
    expect(matchesDateFilter(tenDaysAgoISO, 'yesterday')).toBe(false)
  })

  test('filter "7d" matches last 7 days', () => {
    expect(matchesDateFilter(todayISO, '7d')).toBe(true)
    expect(matchesDateFilter(threeDaysAgoISO, '7d')).toBe(true)
    expect(matchesDateFilter(tenDaysAgoISO, '7d')).toBe(false)
    expect(matchesDateFilter(sixtyDaysAgoISO, '7d')).toBe(false)
  })

  test('filter "30d" matches last 30 days', () => {
    expect(matchesDateFilter(todayISO, '30d')).toBe(true)
    expect(matchesDateFilter(tenDaysAgoISO, '30d')).toBe(true)
    expect(matchesDateFilter(sixtyDaysAgoISO, '30d')).toBe(false)
  })

  test('unknown filter returns true', () => {
    expect(matchesDateFilter(todayISO, 'custom')).toBe(true)
  })
})
