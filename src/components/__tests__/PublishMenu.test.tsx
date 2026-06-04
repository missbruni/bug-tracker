/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type React from 'react'

// Mock devin utils — must come before importing the component
mock.module('../../lib/devin', () => ({
  hasDevinApiKey: () => false,
  openSettings: mock(() => {}),
}))

const { default: PublishMenu } = await import('../PublishMenu')

afterEach(() => cleanup())

function renderPublishMenu(overrides: Partial<React.ComponentProps<typeof PublishMenu>> = {}) {
  return render(
    <PublishMenu
      publishing={false}
      publishingMode={null}
      defaultProvider="azure"
      azureUrl={null}
      nativeBacklogUrl={null}
      onPublishAzure={() => {}}
      onMoveToBacklog={() => {}}
      {...overrides}
    />,
  )
}

describe('PublishMenu', () => {
  test('renders "Publish to Azure" for Azure teams when no Azure URL', () => {
    renderPublishMenu()
    expect(screen.getByText('Publish to Azure')).toBeInTheDocument()
  })

  test('renders "Re-publish to Azure" when Azure URL exists', () => {
    renderPublishMenu({ azureUrl: 'https://example.com' })
    expect(screen.getByText('Re-publish to Azure')).toBeInTheDocument()
  })

  test('renders "Move to Backlog" for Mushi backlog teams', () => {
    renderPublishMenu({ defaultProvider: 'mushi' })
    expect(screen.getByText('Move to Backlog')).toBeInTheDocument()
  })

  test('shows "Publishing..." when publishing is true', () => {
    renderPublishMenu({ publishing: true, publishingMode: 'azure' })
    expect(screen.getByText('Publishing...')).toBeInTheDocument()
  })

  test('shows "Publishing + Devin..." when publishingMode is devin', () => {
    renderPublishMenu({ publishing: true, publishingMode: 'devin' })
    expect(screen.getByText('Publishing + Devin...')).toBeInTheDocument()
  })

  test('calls onPublishAzure(false) when Azure main button is clicked', () => {
    const onPublish = mock(() => {})
    renderPublishMenu({ onPublishAzure: onPublish })
    fireEvent.click(screen.getByText('Publish to Azure'))
    expect(onPublish).toHaveBeenCalledWith(false)
  })

  test('calls onMoveToBacklog when Mushi main button is clicked', () => {
    const onMoveToBacklog = mock(() => {})
    renderPublishMenu({ defaultProvider: 'mushi', onMoveToBacklog })
    fireEvent.click(screen.getByText('Move to Backlog'))
    expect(onMoveToBacklog).toHaveBeenCalled()
  })

  test('opens dropdown menu when chevron is clicked', () => {
    renderPublishMenu()
    fireEvent.click(screen.getByTitle('More publish options'))
    expect(screen.getByText('Move to Mushi Backlog')).toBeInTheDocument()
    expect(screen.getByText('Publish + Devin')).toBeInTheDocument()
  })

  test('shows Devin key missing warning when key is not set', () => {
    renderPublishMenu()
    fireEvent.click(screen.getByTitle('More publish options'))
    fireEvent.click(screen.getByText('Publish + Devin'))
    expect(screen.getByText('Configure your Devin API key first.')).toBeInTheDocument()
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
  })

  test('disables buttons while publishing', () => {
    renderPublishMenu({ publishing: true, publishingMode: 'azure' })
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })
})
