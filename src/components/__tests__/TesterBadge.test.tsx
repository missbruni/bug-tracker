/// <reference lib="dom" />
import { test, expect, describe } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { TesterBadge } from '../TesterBadge'

describe('TesterBadge', () => {
  test('renders the tester name', () => {
    render(<TesterBadge>Alice</TesterBadge>)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  test('renders as a styled span', () => {
    render(<TesterBadge>Bob</TesterBadge>)
    const el = screen.getByText('Bob')
    expect(el.tagName).toBe('SPAN')
    expect(el.className).toContain('rounded-full')
  })
})
