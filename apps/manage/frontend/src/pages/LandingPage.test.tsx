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
    expect(screen.getByText(/Your AI-Powered/)).toBeInTheDocument()
    expect(screen.getAllByText('Chief of Staff').length).toBeGreaterThan(0)
  })

  it('renders the product name in navigation', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getAllByText('Expertly Manage').length).toBeGreaterThan(0)
  })

  it('displays the tagline', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Map your processes. Build your bot army. Let AI push everything forward./)).toBeInTheDocument()
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

  it('displays all capability cards', () => {
    renderWithRouter(<LandingPage />)
    // "Map Your Processes" appears in capabilities and steps section
    expect(screen.getAllByText('Map Your Processes').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Build Your Bot Army')).toBeInTheDocument()
    expect(screen.getByText('Unified Task Hub')).toBeInTheDocument()
    expect(screen.getByText('Proactive Head Starts')).toBeInTheDocument()
    expect(screen.getByText('Multiply Leadership')).toBeInTheDocument()
    expect(screen.getByText('Follow-Up Intelligence')).toBeInTheDocument()
  })

  it('displays capability descriptions', () => {
    renderWithRouter(<LandingPage />)
    // These descriptions appear in multiple places
    expect(screen.getAllByText(/Define who does what/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Gradually delegate steps to specialized bots/).length).toBeGreaterThan(0)
  })

  it('displays all benefits', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Your AI Chief of Staff')).toBeInTheDocument()
    expect(screen.getByText('Processes on autopilot')).toBeInTheDocument()
    expect(screen.getByText('Bots that multiply you')).toBeInTheDocument()
    expect(screen.getByText('Full context everywhere')).toBeInTheDocument()
    expect(screen.getByText('Nothing falls through')).toBeInTheDocument()
    expect(screen.getByText('Scale without chaos')).toBeInTheDocument()
  })

  it('renders the How It Works section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('From chaos to autopilot')).toBeInTheDocument()
    expect(screen.getByText('Four steps to transform how your organization operates')).toBeInTheDocument()
  })

  it('displays the four steps', () => {
    renderWithRouter(<LandingPage />)
    // Map Your Processes appears in both capabilities and steps
    expect(screen.getAllByText('Map Your Processes').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Build Your Bots')).toBeInTheDocument()
    expect(screen.getByText('Centralize Everything')).toBeInTheDocument()
    expect(screen.getByText('Let AI Push Forward')).toBeInTheDocument()
  })

  it('renders step numbers', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders the CTA section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Ready for your AI Chief of Staff?')).toBeInTheDocument()
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

  it('has how-it-works section anchor', () => {
    renderWithRouter(<LandingPage />)
    const howItWorksLink = screen.getByText('See How It Works')
    expect(howItWorksLink.closest('a')).toHaveAttribute('href', '#how-it-works')
  })

  it('renders the vision section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Imagine this...')).toBeInTheDocument()
    expect(screen.getByText('For You')).toBeInTheDocument()
    expect(screen.getByText('For Your Bots')).toBeInTheDocument()
    expect(screen.getByText('For Your Leaders')).toBeInTheDocument()
  })

  it('renders the hero section with proper structure', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/Define how your organization works/)).toBeInTheDocument()
    expect(screen.getByText(/watch as bots take over more and more steps/)).toBeInTheDocument()
  })

  it('renders the capabilities section heading', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Everything you need to run on autopilot')).toBeInTheDocument()
    expect(screen.getByText('From process mapping to proactive AI assistance')).toBeInTheDocument()
  })

  it('renders the integrations section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Pull work from everywhere')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Jira')).toBeInTheDocument()
    expect(screen.getByText('Teamwork')).toBeInTheDocument()
    expect(screen.getByText('+ more coming')).toBeInTheDocument()
  })
})
