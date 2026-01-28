import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/test-utils'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  describe('Navigation', () => {
    it('renders logo and product name', () => {
      render(<LandingPage />)

      // Product name appears in both nav and footer
      const brandNames = screen.getAllByText('Expertly Identity')
      expect(brandNames.length).toBeGreaterThan(0)
      expect(brandNames[0]).toBeInTheDocument()
    })

    it('shows Sign In link', () => {
      render(<LandingPage />)

      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    })

    it('shows Get Started button in navigation', () => {
      render(<LandingPage />)

      // There are multiple "Get Started" links - check that at least one exists
      const getStartedLinks = screen.getAllByRole('link', { name: /get started/i })
      expect(getStartedLinks.length).toBeGreaterThan(0)
      expect(getStartedLinks[0]).toBeInTheDocument()
    })
  })

  describe('Hero Section', () => {
    it('renders main headline', () => {
      render(<LandingPage />)

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/unified identity/i)
    })

    it('renders hero description', () => {
      render(<LandingPage />)

      expect(screen.getByText(/manage users, teams, and organizations/i)).toBeInTheDocument()
    })

    it('shows Start Managing CTA', () => {
      render(<LandingPage />)

      expect(screen.getByRole('link', { name: /start managing/i })).toBeInTheDocument()
    })

    it('shows Learn More link', () => {
      render(<LandingPage />)

      expect(screen.getByRole('link', { name: /learn more/i })).toBeInTheDocument()
    })
  })

  describe('Benefits Bar', () => {
    it('renders benefit items', () => {
      render(<LandingPage />)

      expect(screen.getByText(/centralized user management/i)).toBeInTheDocument()
      expect(screen.getByText(/secure authentication/i)).toBeInTheDocument()
      expect(screen.getByText(/cross-product identity/i)).toBeInTheDocument()
      expect(screen.getByText(/audit trail for compliance/i)).toBeInTheDocument()
      expect(screen.getByText(/easy team collaboration/i)).toBeInTheDocument()
      expect(screen.getByText(/scalable organization structure/i)).toBeInTheDocument()
    })
  })

  describe('Features Section', () => {
    it('renders features heading', () => {
      render(<LandingPage />)

      expect(screen.getByRole('heading', { name: /complete identity management/i })).toBeInTheDocument()
    })

    it('displays feature cards', () => {
      render(<LandingPage />)

      expect(screen.getByText('User Management')).toBeInTheDocument()
      expect(screen.getByText('Team Organization')).toBeInTheDocument()
      expect(screen.getByText('Multi-Tenant Support')).toBeInTheDocument()
      expect(screen.getByText('Role-Based Access')).toBeInTheDocument()
      expect(screen.getByText('Single Sign-On')).toBeInTheDocument()
      expect(screen.getByText('Bot Accounts')).toBeInTheDocument()
    })

    it('shows feature descriptions', () => {
      render(<LandingPage />)

      expect(screen.getByText(/create, update, and manage users/i)).toBeInTheDocument()
      expect(screen.getByText(/group users into teams/i)).toBeInTheDocument()
      expect(screen.getByText(/manage multiple organizations/i)).toBeInTheDocument()
      expect(screen.getByText(/define roles and permissions/i)).toBeInTheDocument()
      expect(screen.getByText(/enable seamless authentication/i)).toBeInTheDocument()
      expect(screen.getByText(/create service accounts/i)).toBeInTheDocument()
    })
  })

  describe('How It Works Section', () => {
    it('renders section heading', () => {
      render(<LandingPage />)

      expect(screen.getByRole('heading', { name: /get started in minutes/i })).toBeInTheDocument()
    })

    it('shows three steps', () => {
      render(<LandingPage />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('displays step titles', () => {
      render(<LandingPage />)

      expect(screen.getByRole('heading', { name: /create organization/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /add team members/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /start collaborating/i })).toBeInTheDocument()
    })

    it('shows step descriptions', () => {
      render(<LandingPage />)

      expect(screen.getByText(/set up your organization with a name/i)).toBeInTheDocument()
      expect(screen.getByText(/invite users, create teams/i)).toBeInTheDocument()
      expect(screen.getByText(/your team can now access/i)).toBeInTheDocument()
    })
  })

  describe('CTA Section', () => {
    it('renders CTA heading', () => {
      render(<LandingPage />)

      expect(screen.getByRole('heading', { name: /ready to unify your identity management/i })).toBeInTheDocument()
    })

    it('shows CTA description', () => {
      render(<LandingPage />)

      expect(screen.getByText(/join organizations that trust/i)).toBeInTheDocument()
    })

    it('shows Get Started Free button', () => {
      render(<LandingPage />)

      expect(screen.getByRole('link', { name: /get started free/i })).toBeInTheDocument()
    })
  })

  describe('Footer', () => {
    it('renders footer logo', () => {
      render(<LandingPage />)

      // Footer contains another instance of the brand name
      const brandNames = screen.getAllByText('Expertly Identity')
      expect(brandNames.length).toBe(2)
      // The second instance is in the footer
      expect(brandNames[1]).toBeInTheDocument()
    })

    it('shows product suite message', () => {
      render(<LandingPage />)

      expect(screen.getByText(/part of the expertly suite/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<LandingPage />)

      const h1 = screen.getByRole('heading', { level: 1 })
      const h2s = screen.getAllByRole('heading', { level: 2 })
      const h3s = screen.getAllByRole('heading', { level: 3 })

      expect(h1).toBeInTheDocument()
      expect(h2s.length).toBeGreaterThan(0)
      expect(h3s.length).toBeGreaterThan(0)
    })

    it('has accessible navigation', () => {
      render(<LandingPage />)

      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
    })

    it('all links have accessible names', () => {
      render(<LandingPage />)

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link).toHaveAccessibleName()
      })
    })
  })
})
