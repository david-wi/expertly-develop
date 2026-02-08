import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Hoisted mocks
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' }),
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Outlet</div>,
  }
})

vi.mock('@expertly/ui', () => ({
  Sidebar: ({ navigation }: { navigation: { name: string; href: string }[] }) => (
    <nav data-testid="sidebar">
      {navigation.map((item: { name: string; href: string }) => (
        <a key={item.name} href={item.href}>{item.name}</a>
      ))}
    </nav>
  ),
  formatBuildTimestamp: () => null,
  useCurrentUser: () => ({ sidebarUser: { name: 'Test', role: 'admin' } }),
  useOrganizations: () => ({ organizationsConfig: undefined, currentOrg: null }),
  createDefaultUserMenu: () => ({}),
}))

vi.mock('../services/api', () => ({
  api: { getCurrentUser: vi.fn() },
}))

vi.mock('../components/NotificationCenter', () => ({
  default: () => <div data-testid="notifications" />,
}))

vi.mock('../components/layout/MobileBottomNav', () => ({
  default: () => <div data-testid="mobile-nav" />,
}))

import Layout from '../components/layout/Layout'

describe('Layout sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders navigation links in sidebar', () => {
    render(<Layout />)
    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toBeInTheDocument()

    // All key navigation links should be present within the sidebar
    const links = sidebar.querySelectorAll('a')
    const linkTexts = Array.from(links).map(a => a.textContent)
    expect(linkTexts).toContain('Dashboard')
    expect(linkTexts).toContain('Shipments')
    expect(linkTexts).toContain('Carriers')
    expect(linkTexts).toContain('Customers')
    expect(linkTexts).toContain('Invoices')
    expect(linkTexts).toContain('Settings')
    expect(links.length).toBe(25)
  })

  it('sidebar wrapper uses max-lg: prefixed translate classes only', () => {
    const { container } = render(<Layout />)

    // Find the sidebar wrapper div (parent of the sidebar element)
    const sidebar = screen.getByTestId('sidebar')
    const wrapper = sidebar.parentElement!

    const classes = wrapper.className

    // REGRESSION CHECK: Tailwind v3.4 uses native CSS `translate` property.
    // Bare `-translate-x-full` applies on ALL viewports (including desktop),
    // and `lg:transform-none` does NOT undo it because `transform` and `translate`
    // are different CSS properties. This caused the sidebar to be pushed offscreen.
    //
    // Translate classes MUST be prefixed with `max-lg:` so they only apply on mobile.
    expect(classes).not.toMatch(/(?<![a-z-:])translate-x-0(?!\S)/),
    expect(classes).not.toMatch(/(?<![a-z-:])-translate-x-full(?!\S)/)
    expect(classes).not.toContain('lg:transform-none')
    expect(classes).not.toContain('lg:translate-x-0')

    // Verify the correct max-lg: pattern is used
    expect(classes).toContain('max-lg:')
    expect(classes).toContain('lg:static')
  })
})
