/// <reference lib="dom" />
import { test, expect, describe, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OnboardingTour from '../OnboardingTour'

afterEach(() => cleanup())

function renderTour(onComplete = mock(() => {})) {
  const utils = render(
    <MemoryRouter initialEntries={['/']}>
      <OnboardingTour onComplete={onComplete} />
    </MemoryRouter>,
  )
  return { ...utils, onComplete }
}

describe('OnboardingTour', () => {
  test('renders the welcome step first', () => {
    renderTour()
    expect(screen.getByText(/Welcome to mushi/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  test('advances to the next step when Next is clicked', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Bugs live here/i)).toBeInTheDocument()
  })

  test('shows a Previous button after the first step', () => {
    renderTour()
    expect(screen.queryByLabelText('Previous step')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByLabelText('Previous step')).toBeInTheDocument()
  })

  test('Previous goes back a step', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Log a bug/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Previous step'))
    expect(screen.getByText(/Bugs live here/i)).toBeInTheDocument()
  })

  test('skip button calls onComplete', () => {
    const { onComplete } = renderTour()
    fireEvent.click(screen.getByLabelText('Skip tour'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  test('Escape key calls onComplete', () => {
    const { onComplete } = renderTour()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  test('final step shows "Got it" and calls onComplete on click', () => {
    const { onComplete } = renderTour()
    // 5 steps total, advance to the last
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next|Got it/ }))
    }
    const finalButton = screen.getByRole('button', { name: 'Got it' })
    expect(finalButton).toBeInTheDocument()
    fireEvent.click(finalButton)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
