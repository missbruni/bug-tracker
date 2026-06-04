/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../NavBar'

afterEach(() => cleanup())

function renderNavBar(props: {
  showBugs?: boolean
  onToggleBugs?: () => void
  bugCount?: number
  userDisplayName?: string
  userEmail?: string
  userAvatarUrl?: string
  onLogout?: () => void
  canSwitchTeams?: boolean
  teamOptions?: Array<{ id: string; organization_id: string; name: string; slug: string }>
  activeTeamId?: string | null
  activeTeamName?: string
  onTeamChange?: (teamId: string) => void
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <NavBar {...props}>
        <span data-testid="child-el">Theme Toggle</span>
      </NavBar>
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  test('renders branding text', () => {
    renderNavBar()
    expect(screen.getByText('Catch every bug before your users do.')).toBeInTheDocument()
  })

  test('renders primary navigation tabs', () => {
    renderNavBar()
    expect(screen.getAllByText('Bugs').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Backlog').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Sessions').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Insights').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Participants')).not.toBeInTheDocument()
  })

  test('highlights Bugs tab when on / route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavBar />
      </MemoryRouter>,
    )
    const bugsLinks = screen.getAllByText('Bugs')
    const activeLink = bugsLinks.find(el => el.closest('a')?.className.includes('text-blue-600'))
    expect(activeLink).toBeTruthy()
  })

  test('highlights Sessions tab when on /sessions route', () => {
    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <NavBar />
      </MemoryRouter>,
    )
    const sessionsLinks = screen.getAllByText('Sessions')
    const activeLink = sessionsLinks.find(el => el.closest('a')?.className.includes('text-blue-600'))
    expect(activeLink).toBeTruthy()
  })

  test('highlights Sessions tab when on participant routes', () => {
    for (const route of ['/participants', '/testers']) {
      cleanup()
      render(
        <MemoryRouter initialEntries={[route]}>
          <NavBar />
        </MemoryRouter>,
      )
      const sessionsLinks = screen.getAllByText('Sessions')
      const activeLink = sessionsLinks.find(el => el.closest('a')?.className.includes('text-blue-600'))
      expect(activeLink).toBeTruthy()
    }
  })

  test('calls onToggleBugs when bug icon is clicked', () => {
    const onToggleBugs = mock(() => {})
    renderNavBar({ showBugs: false, onToggleBugs })
    const toggleBtn = screen.getByTitle('Show crawling bugs (⌘B)')
    fireEvent.click(toggleBtn)
    expect(onToggleBugs).toHaveBeenCalledTimes(1)
  })

  test('renders children in the right slot', () => {
    renderNavBar()
    expect(screen.getByTestId('child-el')).toBeInTheDocument()
  })

  test('logout is accessible via profile dropdown', () => {
    const onLogout = mock(() => {})
    renderNavBar({ onLogout, userDisplayName: 'Bruna Lima', userEmail: 'bruna@example.com' })

    const profileBtn = screen.getAllByLabelText('Profile menu')[0]
    fireEvent.click(profileBtn)

    const logoutBtn = screen.getAllByText('Logout')[0]
    fireEvent.click(logoutBtn)

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  test('renders compact user chip with initials and hides full email text', () => {
    renderNavBar({
      userDisplayName: 'Bruna Lima',
      userEmail: 'bruna.lima@theaccessgroup.com',
    })

    expect(screen.getByText('Bruna Lima')).toBeInTheDocument()
    expect(screen.getByText('BL')).toBeInTheDocument()
    expect(screen.queryByText('bruna.lima@theaccessgroup.com')).not.toBeInTheDocument()
  })

  test('renders user avatar image when URL is provided', () => {
    renderNavBar({
      userDisplayName: 'Bruna Lima',
      userAvatarUrl: 'https://example.com/avatar.png',
    })

    const avatars = screen.getAllByRole('img', { name: 'Bruna Lima avatar' })
    expect(avatars.length).toBeGreaterThanOrEqual(1)
  })

  test('renders team switcher as a badge dropdown when multiple teams are available', () => {
    const onTeamChange = mock(() => {})
    renderNavBar({
      activeTeamName: 'The Avengers',
      activeTeamId: 'team-1',
      canSwitchTeams: true,
      onTeamChange,
      teamOptions: [
        { id: 'team-1', organization_id: 'org', name: 'The Avengers', slug: 'avengers' },
        { id: 'team-2', organization_id: 'org', name: 'X-Men', slug: 'x-men' },
      ],
    })

    const switcher = screen.getByRole('button', { name: /switch active team/i })
    expect(switcher).toHaveTextContent('Team: The Avengers')

    fireEvent.click(switcher)
    fireEvent.click(screen.getByRole('button', { name: 'X-Men' }))

    expect(onTeamChange).toHaveBeenCalledWith('team-2')
  })
})
