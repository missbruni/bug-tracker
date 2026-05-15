/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../NavBar'

afterEach(() => cleanup())

function renderNavBar(props: { showBugs?: boolean; onToggleBugs?: () => void; bugCount?: number } = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <NavBar {...props} />
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  test('renders branding text', () => {
    renderNavBar()
    expect(screen.getByText('Bug Catcher')).toBeInTheDocument()
  })

  test('renders all navigation tabs', () => {
    renderNavBar()
    expect(screen.getAllByText('Bugs').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Sessions').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Testers').length).toBeGreaterThanOrEqual(1)
  })

  test('highlights Bugs tab when on / route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavBar />
      </MemoryRouter>,
    )
    const bugsLinks = screen.getAllByText('Bugs')
    const activeLink = bugsLinks.find(el => el.closest('a')?.className.includes('border-blue-500'))
    expect(activeLink).toBeTruthy()
  })

  test('highlights Sessions tab when on /sessions route', () => {
    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <NavBar />
      </MemoryRouter>,
    )
    const sessionsLinks = screen.getAllByText('Sessions')
    const activeLink = sessionsLinks.find(el => el.closest('a')?.className.includes('border-blue-500'))
    expect(activeLink).toBeTruthy()
  })

  test('calls onToggleBugs when bug icon is clicked', () => {
    const onToggleBugs = mock(() => {})
    renderNavBar({ showBugs: true, onToggleBugs })
    const toggleBtn = screen.getByTitle('Hide crawling bugs (⌘B)')
    fireEvent.click(toggleBtn)
    expect(onToggleBugs).toHaveBeenCalledTimes(1)
  })

  test('renders children in the right slot', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavBar>
          <span data-testid="child-el">Theme Toggle</span>
        </NavBar>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('child-el')).toBeInTheDocument()
  })
})
