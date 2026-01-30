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
    expect(screen.getByText(/Put Your Organization on/)).toBeInTheDocument()
    expect(screen.getByText('Autopilot')).toBeInTheDocument()
  })

  it('renders the product name in navigation', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getAllByText('Expertly Manage').length).toBeGreaterThan(0)
  })

  it('displays the tagline', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Scheduled and event-driven workflows that run themselves')).toBeInTheDocument()
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
    expect(screen.getByText('Scheduled Workflows')).toBeInTheDocument()
    expect(screen.getByText('Event-Driven Triggers')).toBeInTheDocument()
    expect(screen.getByText('Unified Inbox')).toBeInTheDocument()
    expect(screen.getByText('Bot Execution')).toBeInTheDocument()
    expect(screen.getByText('Human Approval Gates')).toBeInTheDocument()
    expect(screen.getByText('Playbook Builder')).toBeInTheDocument()
  })

  it('displays feature descriptions', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Define what needs to happen and when/)).toBeInTheDocument()
    expect(screen.getByText(/React instantly when things happen/)).toBeInTheDocument()
  })

  it('displays all benefits', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Run on autopilot')).toBeInTheDocument()
    expect(screen.getByText('Never miss a deadline')).toBeInTheDocument()
    expect(screen.getByText('Unified task inbox')).toBeInTheDocument()
    expect(screen.getByText('Bots do the work')).toBeInTheDocument()
    expect(screen.getByText('You stay in control')).toBeInTheDocument()
    expect(screen.getByText('Scale effortlessly')).toBeInTheDocument()
  })

  it('renders the How It Works section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('How It Works')).toBeInTheDocument()
    expect(screen.getByText('Set it up once. Let it run forever.')).toBeInTheDocument()
  })

  it('displays the three steps', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Define Your Workflows')).toBeInTheDocument()
    expect(screen.getByText('Bots Execute')).toBeInTheDocument()
    expect(screen.getByText('You Approve')).toBeInTheDocument()
  })

  it('renders step numbers', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders the CTA section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Ready to put your organization on autopilot?')).toBeInTheDocument()
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
    const featureNames = [
      'Scheduled Workflows',
      'Event-Driven Triggers',
      'Unified Inbox',
      'Bot Execution',
      'Human Approval Gates',
      'Playbook Builder',
    ]
    featureNames.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument()
    })
  })

  it('renders the hero section with proper structure', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Schedule recurring tasks, react to events from email and Slack/)).toBeInTheDocument()
    expect(screen.getByText(/let bots handle the routine work/)).toBeInTheDocument()
  })

  it('renders the features section heading', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Automation that keeps you in control')).toBeInTheDocument()
    expect(screen.getByText(/Schedule workflows, react to events, and let bots do the heavy lifting/)).toBeInTheDocument()
  })

  it('renders the integrations section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Connect Your Tools')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Jira')).toBeInTheDocument()
    expect(screen.getByText('Teamwork')).toBeInTheDocument()
    expect(screen.getByText('+ more coming')).toBeInTheDocument()
  })
})
