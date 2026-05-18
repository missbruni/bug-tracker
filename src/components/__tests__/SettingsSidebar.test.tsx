/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach, beforeEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsSidebar from '../SettingsSidebar'

afterEach(() => cleanup())
beforeEach(() => {
  localStorage.removeItem('devin_api_key')
  localStorage.removeItem('azure_open_pbi_on_success')
})

describe('SettingsSidebar', () => {
  test('renders when open', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Devin Integration')).toBeInTheDocument()
  })

  test('renders API key input', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    expect(screen.getByPlaceholderText('apk_user_xxxxxxxx')).toBeInTheDocument()
  })

  test('save button is disabled when key is empty', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    const saveBtns = screen.getAllByText('Save')
    expect(saveBtns[0].closest('button')).toBeDisabled()
  })

  test('shows validation error for invalid key', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('apk_user_xxxxxxxx')
    fireEvent.change(input, { target: { value: 'sk_invalid_key' } })
    fireEvent.click(screen.getAllByText('Save')[0])
    expect(screen.getByText(/Key must start with apk_user/)).toBeInTheDocument()
  })

  test('saves valid key to localStorage', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    const input = screen.getByPlaceholderText('apk_user_xxxxxxxx')
    fireEvent.change(input, { target: { value: 'apk_user_test123' } })
    fireEvent.click(screen.getAllByText('Save')[0])
    expect(localStorage.getItem('devin_api_key')).toBe('apk_user_test123')
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  test('shows Remove button when key exists', () => {
    localStorage.setItem('devin_api_key', 'apk_user_existing')
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  test('clears key when Remove is clicked', () => {
    localStorage.setItem('devin_api_key', 'apk_user_existing')
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Remove'))
    expect(localStorage.getItem('devin_api_key')).toBeNull()
  })

  test('calls onClose when backdrop is clicked', () => {
    const onClose = mock(() => {})
    const { container } = render(<SettingsSidebar open={true} onClose={onClose} />)
    const backdrop = container.querySelector('.fixed.inset-0')
    if (backdrop) fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('renders link to Devin docs', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    expect(screen.getByText('How to get your Devin API key')).toBeInTheDocument()
  })

  test('renders Azure publish setting enabled by default', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    const azureToggle = screen.getByRole('checkbox', { name: /open pbi in new tab after publish succeeds/i })
    expect(azureToggle).toBeChecked()
  })

  test('persists Azure publish setting when toggled off', () => {
    render(<SettingsSidebar open={true} onClose={() => {}} />)
    const azureToggle = screen.getByRole('checkbox', { name: /open pbi in new tab after publish succeeds/i })
    fireEvent.click(azureToggle)
    expect(localStorage.getItem('azure_open_pbi_on_success')).toBe('false')
  })
})
