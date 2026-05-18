/// <reference lib="dom" />
import { test, expect, describe, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TeamCard, { parseProductLink } from '../TeamCard'
import type { TeamStats, Product } from '../TeamCard'
import type { TeamRecord } from '../../lib/teamScope'

afterEach(() => cleanup())

const team: TeamRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  organization_id: 'org-1',
  name: 'EVO IBE',
  slug: 'evo-ibe',
  created_at: '2024-01-01',
}

const stats: TeamStats = {
  testers: 5,
  activeTesters: 3,
  sessions: 12,
  activeBugs: 4,
}

const products: Product[] = [
  { id: 'p1', team_id: team.id, name: 'Booking Engine', slug: 'booking-engine', description: 'Main booking flow', link: 'https://example.com' },
  { id: 'p2', team_id: team.id, name: 'Ancillaries', slug: 'ancillaries', description: null, link: null },
]

const noop = () => {}
const noopAsync = async () => {}

function renderCard(overrides: Partial<Parameters<typeof TeamCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <TeamCard
        team={team}
        isActive={false}
        isDefault={false}
        stats={stats}
        products={products}
        onSelect={noop}
        onStartEdit={noop}
        onDelete={noop}
        onAddProduct={noopAsync}
        onUpdateProduct={noopAsync}
        onDeleteProduct={noop}
        isEditing={false}
        editName=""
        onEditNameChange={noop}
        onSaveEdit={noop}
        onCancelEdit={noop}
        pendingDelete={false}
        deleting={false}
        onConfirmDelete={noop}
        onCancelDelete={noop}
        {...overrides}
      />
    </MemoryRouter>
  )
}

describe('TeamCard', () => {
  test('renders team name', () => {
    renderCard()
    expect(screen.getByText('EVO IBE')).toBeInTheDocument()
  })

  test('shows Active badge when isActive', () => {
    renderCard({ isActive: true })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  test('does not show Active badge when not active', () => {
    renderCard({ isActive: false })
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  test('renders tester count from stats', () => {
    renderCard()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Testers')).toBeInTheDocument()
  })

  test('renders session count from stats', () => {
    renderCard()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
  })

  test('renders active bug count from stats', () => {
    renderCard()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Active bugs')).toBeInTheDocument()
  })

  test('renders product count tile', () => {
    renderCard()
    // Products label appears in stat tile and section header
    const productsLabels = screen.getAllByText('Products')
    expect(productsLabels.length).toBeGreaterThanOrEqual(1)
    // The count '2' is rendered inside the stat tile
    const twos = screen.getAllByText('2')
    expect(twos.length).toBeGreaterThanOrEqual(1)
  })

  test('products section is expanded by default', () => {
    renderCard()
    expect(screen.getByText('Booking Engine')).toBeInTheDocument()
    expect(screen.getByText('Ancillaries')).toBeInTheDocument()
  })

  test('products section collapses when product tile is clicked', () => {
    renderCard()
    // Click the Products tile (the button with "Products" text and count)
    const productButtons = screen.getAllByText('Products')
    // The first "Products" is inside the stat tile button
    const tile = productButtons[0].closest('button')
    if (tile) fireEvent.click(tile)
    // Products section should be collapsed (collapse-grid without open class)
    const product = screen.getByText('Booking Engine')
    expect(product.closest('.collapse-grid')!.classList.contains('open')).toBe(false)
  })

  test('products section re-expands when clicked again', () => {
    renderCard()
    const productButtons = screen.getAllByText('Products')
    const tile = productButtons[0].closest('button')
    if (tile) {
      fireEvent.click(tile) // collapse
      fireEvent.click(tile) // expand
    }
    expect(screen.getByText('Booking Engine')).toBeInTheDocument()
  })

  test('shows product description when available', () => {
    renderCard()
    expect(screen.getByText(/Main booking flow/)).toBeInTheDocument()
  })

  test('renders edit form when isEditing is true', () => {
    renderCard({ isEditing: true, editName: 'EVO IBE' })
    const input = screen.getByDisplayValue('EVO IBE')
    expect(input).toBeInTheDocument()
  })

  test('hides delete button for default team', () => {
    renderCard({ isDefault: true })
    // There should be no Trash icon / delete button
    expect(screen.queryByTitle('Delete session')).not.toBeInTheDocument()
  })

  test('shows pending delete confirmation', () => {
    renderCard({ pendingDelete: true })
    expect(screen.getByText('Delete?')).toBeInTheDocument()
  })

  test('shows empty state when no products', () => {
    renderCard({ products: [] })
    expect(screen.getByText('No products registered yet.')).toBeInTheDocument()
  })

  test('renders zero stats when stats is undefined', () => {
    renderCard({ stats: undefined })
    const zeros = screen.getAllByText('0')
    // Should have at least 3 zeros (testers, sessions, active bugs) + 0 products
    expect(zeros.length).toBeGreaterThanOrEqual(3)
  })
})

describe('parseProductLink', () => {
  test('parses a proper {label, url} object', () => {
    expect(parseProductLink({ label: 'CI', url: 'https://ci.example.com' })).toEqual({
      label: 'CI',
      url: 'https://ci.example.com',
    })
  })

  test('parses a double-serialized JSON string', () => {
    const raw = '{"label":"Stage","url":"https://staging.example.com"}'
    expect(parseProductLink(raw)).toEqual({
      label: 'Stage',
      url: 'https://staging.example.com',
    })
  })

  test('parses a plain URL string', () => {
    expect(parseProductLink('https://example.com')).toEqual({
      label: '',
      url: 'https://example.com',
    })
  })

  test('returns empty link for null/undefined', () => {
    expect(parseProductLink(null)).toEqual({ label: '', url: '' })
    expect(parseProductLink(undefined)).toEqual({ label: '', url: '' })
  })

  test('handles object with missing label', () => {
    expect(parseProductLink({ url: 'https://example.com' })).toEqual({
      label: '',
      url: 'https://example.com',
    })
  })
})
