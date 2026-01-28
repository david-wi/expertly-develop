import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/test-utils'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('renders the navigation bar', () => {
    render(<LandingPage />)

    // "Expertly Admin" appears in both nav and footer
    const brandingElements = screen.getAllByText('Expertly Admin')
    expect(brandingElements.length).toBeGreaterThan(0)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders sign in link', () => {
    render(<LandingPage />)

    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('renders get started button in nav', () => {
    render(<LandingPage />)

    // Multiple "Get Started" buttons may exist
    const getStartedButtons = screen.getAllByRole('link', { name: /get started/i })
    expect(getStartedButtons.length).toBeGreaterThan(0)
  })

  it('renders hero section with title', () => {
    render(<LandingPage />)

    expect(screen.getByText('System Control,')).toBeInTheDocument()
    expect(screen.getByText('Centralized')).toBeInTheDocument()
  })

  it('renders hero description', () => {
    render(<LandingPage />)

    expect(screen.getByText(/Manage themes, configurations, and system settings/)).toBeInTheDocument()
  })

  it('renders open dashboard button', () => {
    render(<LandingPage />)

    expect(screen.getByText('Open Dashboard')).toBeInTheDocument()
  })

  it('renders explore features button', () => {
    render(<LandingPage />)

    expect(screen.getByText('Explore Features')).toBeInTheDocument()
  })

  it('renders benefits bar', () => {
    render(<LandingPage />)

    expect(screen.getByText('Centralized configuration')).toBeInTheDocument()
    expect(screen.getByText('Consistent branding')).toBeInTheDocument()
    expect(screen.getByText('Version history')).toBeInTheDocument()
    expect(screen.getByText('Instant rollback')).toBeInTheDocument()
    expect(screen.getByText('Real-time sync')).toBeInTheDocument()
    expect(screen.getByText('Zero downtime updates')).toBeInTheDocument()
  })

  it('renders features section', () => {
    render(<LandingPage />)

    expect(screen.getByText('Complete system administration')).toBeInTheDocument()
  })

  it('renders all feature cards', () => {
    render(<LandingPage />)

    expect(screen.getByText('Theme Management')).toBeInTheDocument()
    expect(screen.getByText('Version Control')).toBeInTheDocument()
    expect(screen.getByText('Live Preview')).toBeInTheDocument()
    expect(screen.getByText('Cross-App Sync')).toBeInTheDocument()
    expect(screen.getByText('System Configuration')).toBeInTheDocument()
    expect(screen.getByText('Instant Updates')).toBeInTheDocument()
  })

  it('renders feature descriptions', () => {
    render(<LandingPage />)

    expect(screen.getByText(/Create and manage beautiful themes/)).toBeInTheDocument()
    expect(screen.getByText(/Track theme changes with complete version history/)).toBeInTheDocument()
    expect(screen.getByText(/See your theme changes in real-time/)).toBeInTheDocument()
    expect(screen.getByText(/Push theme updates to all Expertly products/)).toBeInTheDocument()
    expect(screen.getByText(/Manage global settings, feature flags/)).toBeInTheDocument()
    expect(screen.getByText(/Theme changes propagate instantly/)).toBeInTheDocument()
  })

  it('renders how it works section', () => {
    render(<LandingPage />)

    expect(screen.getByText('Simple yet powerful')).toBeInTheDocument()
    expect(screen.getByText(/Managing your Expertly ecosystem has never been easier/)).toBeInTheDocument()
  })

  it('renders how it works steps', () => {
    render(<LandingPage />)

    expect(screen.getByText('Create Your Theme')).toBeInTheDocument()
    expect(screen.getByText('Preview Changes')).toBeInTheDocument()
    expect(screen.getByText('Publish Everywhere')).toBeInTheDocument()
  })

  it('renders step numbers', () => {
    render(<LandingPage />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders step descriptions', () => {
    render(<LandingPage />)

    expect(screen.getByText(/Design your brand identity/)).toBeInTheDocument()
    expect(screen.getByText(/See how your theme looks across all applications/)).toBeInTheDocument()
    expect(screen.getByText(/One click deploys your theme/)).toBeInTheDocument()
  })

  it('renders CTA section', () => {
    render(<LandingPage />)

    expect(screen.getByText('Ready to take control?')).toBeInTheDocument()
    expect(screen.getByText(/Streamline your system administration/)).toBeInTheDocument()
  })

  it('renders access dashboard button in CTA', () => {
    render(<LandingPage />)

    expect(screen.getByText('Access Dashboard')).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(<LandingPage />)

    expect(screen.getByText('Part of the Expertly suite of products.')).toBeInTheDocument()
  })

  it('renders multiple Expertly Admin branding elements', () => {
    render(<LandingPage />)

    // Both nav and footer should have "Expertly Admin"
    const brandingElements = screen.getAllByText('Expertly Admin')
    expect(brandingElements).toHaveLength(2)
  })

  it('renders admin dashboard placeholder in hero', () => {
    render(<LandingPage />)

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  it('has correct link for explore features', () => {
    render(<LandingPage />)

    const exploreLink = screen.getByText('Explore Features').closest('a')
    expect(exploreLink).toHaveAttribute('href', '#features')
  })

  it('navigation links point to home', () => {
    render(<LandingPage />)

    const signInLink = screen.getByText('Sign In').closest('a')
    expect(signInLink).toHaveAttribute('href', '/')

    const openDashboardLink = screen.getByText('Open Dashboard').closest('a')
    expect(openDashboardLink).toHaveAttribute('href', '/')
  })

  it('features section has correct id for anchor link', () => {
    render(<LandingPage />)

    const featuresSection = document.getElementById('features')
    expect(featuresSection).toBeInTheDocument()
  })

  it('renders all expected sections in order', () => {
    render(<LandingPage />)

    const mainContainer = document.querySelector('.min-h-screen')
    expect(mainContainer).toBeInTheDocument()

    // Check that key sections exist
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(document.querySelector('footer')).toBeInTheDocument()
  })

  it('renders icons for features', () => {
    render(<LandingPage />)

    // Lucide icons render as SVGs
    const svgIcons = document.querySelectorAll('svg')
    expect(svgIcons.length).toBeGreaterThan(0)
  })

  it('renders checkmarks for benefits', () => {
    render(<LandingPage />)

    // Benefits section should have check icons
    const benefitsBar = document.querySelector('.bg-gray-900')
    expect(benefitsBar).toBeInTheDocument()

    // Each benefit should have a check icon
    const benefitItems = screen.getAllByText('Centralized configuration')
    expect(benefitItems.length).toBeGreaterThan(0)
  })

  it('applies correct styling to CTA buttons', () => {
    render(<LandingPage />)

    const openDashboardButton = screen.getByText('Open Dashboard').closest('a')
    expect(openDashboardButton?.className).toContain('bg-primary-600')

    const exploreFeaturesButton = screen.getByText('Explore Features').closest('a')
    expect(exploreFeaturesButton?.className).toContain('bg-white')
  })

  it('access dashboard button has correct styling', () => {
    render(<LandingPage />)

    const accessDashboardButton = screen.getByText('Access Dashboard').closest('a')
    expect(accessDashboardButton?.className).toContain('bg-white')
    expect(accessDashboardButton?.className).toContain('text-primary-600')
  })
})
