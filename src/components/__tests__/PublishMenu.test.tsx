/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock devin utils — must come before importing the component
mock.module('../../lib/devin', () => ({
  hasDevinApiKey: () => false,
  openSettings: mock(() => {}),
}))

const { default: PublishMenu } = await import('../PublishMenu')

afterEach(() => cleanup())

describe('PublishMenu', () => {
  test('renders "Publish to Backlog" when no backlog URL', () => {
    render(<PublishMenu publishing={false} publishingMode={null} backlogUrl={null} onPublish={() => {}} />)
    expect(screen.getByText('Publish to Backlog')).toBeInTheDocument()
  })

  test('renders "Re-publish" when backlog URL exists', () => {
    render(<PublishMenu publishing={false} publishingMode={null} backlogUrl="https://example.com" onPublish={() => {}} />)
    expect(screen.getByText('Re-publish')).toBeInTheDocument()
  })

  test('shows "Publishing..." when publishing is true', () => {
    render(<PublishMenu publishing={true} publishingMode="backlog" backlogUrl={null} onPublish={() => {}} />)
    expect(screen.getByText('Publishing...')).toBeInTheDocument()
  })

  test('shows "Publishing + Devin..." when publishingMode is devin', () => {
    render(<PublishMenu publishing={true} publishingMode="devin" backlogUrl={null} onPublish={() => {}} />)
    expect(screen.getByText('Publishing + Devin...')).toBeInTheDocument()
  })

  test('calls onPublish(false) when main button is clicked', () => {
    const onPublish = mock(() => {})
    render(<PublishMenu publishing={false} publishingMode={null} backlogUrl={null} onPublish={onPublish} />)
    fireEvent.click(screen.getByText('Publish to Backlog'))
    expect(onPublish).toHaveBeenCalledWith(false)
  })

  test('opens dropdown menu when chevron is clicked', () => {
    render(<PublishMenu publishing={false} publishingMode={null} backlogUrl={null} onPublish={() => {}} />)
    fireEvent.click(screen.getByTitle('More publish options'))
    expect(screen.getByText('Publish + Devin')).toBeInTheDocument()
  })

  test('shows Devin key missing warning when key is not set', () => {
    render(<PublishMenu publishing={false} publishingMode={null} backlogUrl={null} onPublish={() => {}} />)
    fireEvent.click(screen.getByTitle('More publish options'))
    fireEvent.click(screen.getByText('Publish + Devin'))
    expect(screen.getByText('Configure your Devin API key first.')).toBeInTheDocument()
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
  })

  test('disables buttons while publishing', () => {
    render(<PublishMenu publishing={true} publishingMode="backlog" backlogUrl={null} onPublish={() => {}} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })
})
