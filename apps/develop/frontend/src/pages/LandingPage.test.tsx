import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/test-utils'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  describe('Navigation', () => {
    it('renders the navigation bar', () => {
      render(<LandingPage />)

      // Multiple instances exist (header and footer)
      const brandNames = screen.getAllByText('Expertly Develop')
      expect(brandNames.length).toBeGreaterThan(0)
    })

    it('renders Sign In link', () => {
      render(<LandingPage />)

      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })

    it('renders Get Started button', () => {
      render(<LandingPage />)

      const getStartedButtons = screen.getAllByText('Get Started')
      expect(getStartedButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Hero Section', () => {
    it('renders the main headline', () => {
      render(<LandingPage />)

      expect(screen.getByText('Visual Walkthroughs,')).toBeInTheDocument()
      expect(screen.getByText('Automatically')).toBeInTheDocument()
    })

    it('renders the hero description', () => {
      render(<LandingPage />)

      expect(
        screen.getByText(
          'Generate beautiful step-by-step guides for your web applications in minutes. No more manual screenshots. No more outdated documentation.'
        )
      ).toBeInTheDocument()
    })

    it('renders Start Free Trial button', () => {
      render(<LandingPage />)

      expect(screen.getByText('Start Free Trial')).toBeInTheDocument()
    })

    it('renders See How It Works link', () => {
      render(<LandingPage />)

      expect(screen.getByText('See How It Works')).toBeInTheDocument()
    })

    it('renders Product Demo placeholder', () => {
      render(<LandingPage />)

      expect(screen.getByText('Product Demo')).toBeInTheDocument()
    })
  })

  describe('Benefits Bar', () => {
    const benefits = [
      'Save hours on documentation',
      'Keep guides always up-to-date',
      'Reduce support tickets',
      'Onboard users faster',
      'Improve product adoption',
      'Scale without extra headcount',
    ]

    benefits.forEach((benefit) => {
      it(`displays benefit: ${benefit}`, () => {
        render(<LandingPage />)

        expect(screen.getByText(benefit)).toBeInTheDocument()
      })
    })
  })

  describe('Features Section', () => {
    it('renders features section header', () => {
      render(<LandingPage />)

      expect(
        screen.getByText('Everything you need for great documentation')
      ).toBeInTheDocument()
    })

    const features = [
      {
        name: 'Automated Walkthroughs',
        description: 'Generate step-by-step visual guides for any web application automatically. No manual screenshots needed.',
      },
      {
        name: 'AI-Powered Narration',
        description: 'Intelligent descriptions and annotations that explain each step clearly for your users.',
      },
      {
        name: 'Multiple Output Formats',
        description: 'Export as videos, PDFs, or interactive HTML guides. Choose what works best for your audience.',
      },
      {
        name: 'Persona-Based Testing',
        description: 'Create walkthroughs from different user perspectives to ensure comprehensive coverage.',
      },
      {
        name: 'Lightning Fast',
        description: 'Queue multiple walkthrough jobs and let them run in parallel. Get results in minutes, not hours.',
      },
      {
        name: 'Any Web App',
        description: 'Works with any web application. Just provide the URL and we handle the rest.',
      },
    ]

    features.forEach(({ name, description }) => {
      it(`displays feature: ${name}`, () => {
        render(<LandingPage />)

        expect(screen.getByText(name)).toBeInTheDocument()
        expect(screen.getByText(description)).toBeInTheDocument()
      })
    })
  })

  describe('How It Works Section', () => {
    it('renders how it works section header', () => {
      render(<LandingPage />)

      expect(screen.getByText('Three steps to perfect walkthroughs')).toBeInTheDocument()
    })

    it('renders step 1 - Enter Your URL', () => {
      render(<LandingPage />)

      expect(screen.getByText('Enter Your URL')).toBeInTheDocument()
      expect(
        screen.getByText('Point us to your web application. We support any publicly accessible URL.')
      ).toBeInTheDocument()
    })

    it('renders step 2 - Define the Scenario', () => {
      render(<LandingPage />)

      expect(screen.getByText('Define the Scenario')).toBeInTheDocument()
      expect(
        screen.getByText('Tell us what workflow to document. Use natural language or pick from templates.')
      ).toBeInTheDocument()
    })

    it('renders step 3 - Get Your Walkthrough', () => {
      render(<LandingPage />)

      expect(screen.getByText('Get Your Walkthrough')).toBeInTheDocument()
      expect(
        screen.getByText('Receive a polished visual guide ready to share with your users.')
      ).toBeInTheDocument()
    })

    it('renders step numbers', () => {
      render(<LandingPage />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('CTA Section', () => {
    it('renders CTA headline', () => {
      render(<LandingPage />)

      expect(
        screen.getByText('Ready to transform your documentation?')
      ).toBeInTheDocument()
    })

    it('renders CTA description', () => {
      render(<LandingPage />)

      expect(
        screen.getByText('Join teams who save hours every week with automated visual guides.')
      ).toBeInTheDocument()
    })

    it('renders Start Your Free Trial button', () => {
      render(<LandingPage />)

      expect(screen.getByText('Start Your Free Trial')).toBeInTheDocument()
    })
  })

  describe('Footer', () => {
    it('renders footer with brand name', () => {
      render(<LandingPage />)

      // Multiple instances of "Expertly Develop" - check footer specifically
      const footerBrandNames = screen.getAllByText('Expertly Develop')
      expect(footerBrandNames.length).toBeGreaterThan(1) // Header and footer
    })

    it('renders Expertly suite mention', () => {
      render(<LandingPage />)

      expect(
        screen.getByText('Part of the Expertly suite of products.')
      ).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('renders accessible navigation', () => {
      render(<LandingPage />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('has accessible links', () => {
      render(<LandingPage />)

      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
    })
  })
})
