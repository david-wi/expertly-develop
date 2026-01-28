import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LandingPage from './LandingPage'

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('LandingPage', () => {
  it('renders the main heading', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Queue-Driven Task Management/)).toBeInTheDocument()
    expect(screen.getByText('Simplified')).toBeInTheDocument()
  })

  it('renders the product name in navigation', () => {
    renderWithRouter(<LandingPage />)
    // Product name appears in both header and footer
    expect(screen.getAllByText('Expertly Manage').length).toBeGreaterThan(0)
  })

  it('displays the tagline', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Your organization on autopilot')).toBeInTheDocument()
  })

  it('renders Sign In link', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('renders Get Started button', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('renders Start Free Trial button', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Start Free Trial')).toBeInTheDocument()
  })

  it('renders See How It Works link', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('See How It Works')).toBeInTheDocument()
  })

  it('displays all feature cards', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Task Queues')).toBeInTheDocument()
    expect(screen.getByText('Team Assignments')).toBeInTheDocument()
    expect(screen.getByText('Recurring Tasks')).toBeInTheDocument()
    expect(screen.getByText('Priority Management')).toBeInTheDocument()
    expect(screen.getByText('Progress Tracking')).toBeInTheDocument()
    expect(screen.getByText('Team Collaboration')).toBeInTheDocument()
  })

  it('displays feature descriptions', () => {
    renderWithRouter(<LandingPage />)
    expect(
      screen.getByText(
        /Organize work into smart queues that automatically prioritize and distribute tasks/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Set up recurring tasks that automatically regenerate on schedule/)
    ).toBeInTheDocument()
  })

  it('displays all benefits', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Reduce task chaos')).toBeInTheDocument()
    expect(screen.getByText('Improve team visibility')).toBeInTheDocument()
    expect(screen.getByText('Never drop the ball')).toBeInTheDocument()
    expect(screen.getByText('Scale operations smoothly')).toBeInTheDocument()
    expect(screen.getByText('Automate routine work')).toBeInTheDocument()
    expect(screen.getByText('Track everything')).toBeInTheDocument()
  })

  it('renders the How It Works section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Three steps to organized work')).toBeInTheDocument()
    expect(screen.getByText("Getting started is simple. Here's how it works.")).toBeInTheDocument()
  })

  it('displays the three steps', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Create Your Queues')).toBeInTheDocument()
    expect(screen.getByText('Add Tasks')).toBeInTheDocument()
    expect(screen.getByText('Work the Queue')).toBeInTheDocument()
  })

  it('renders step numbers', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders the CTA section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText("Ready to bring order to your team's work?")).toBeInTheDocument()
    expect(screen.getByText('Start Your Free Trial')).toBeInTheDocument()
  })

  it('renders the footer', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Part of the Expertly suite of products.')).toBeInTheDocument()
  })

  it('has correct navigation links', () => {
    renderWithRouter(<LandingPage />)

    const signInLink = screen.getByText('Sign In')
    expect(signInLink.closest('a')).toHaveAttribute('href', '/')

    const getStartedLink = screen.getByText('Get Started')
    expect(getStartedLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('has features section anchor', () => {
    renderWithRouter(<LandingPage />)

    const howItWorksLink = screen.getByText('See How It Works')
    expect(howItWorksLink.closest('a')).toHaveAttribute('href', '#features')
  })

  it('renders feature icons', () => {
    renderWithRouter(<LandingPage />)

    // Features section should have 6 feature cards
    const featureNames = [
      'Task Queues',
      'Team Assignments',
      'Recurring Tasks',
      'Priority Management',
      'Progress Tracking',
      'Team Collaboration',
    ]

    featureNames.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument()
    })
  })

  it('renders the hero section with proper structure', () => {
    renderWithRouter(<LandingPage />)

    // Check for the hero description
    expect(
      screen.getByText(/Stop chasing tasks across spreadsheets and chat threads/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Expertly Manage brings order to chaos with intelligent task queues/)
    ).toBeInTheDocument()
  })

  it('renders the features section heading', () => {
    renderWithRouter(<LandingPage />)

    expect(
      screen.getByText('Everything you need to manage work effectively')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Powerful features that bring clarity and control/)
    ).toBeInTheDocument()
  })
})
