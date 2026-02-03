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
    expect(screen.getByText(/Mission Control for/)).toBeInTheDocument()
    expect(screen.getByText(/the Amplified Team/)).toBeInTheDocument()
  })

  it('renders the product name in navigation', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getAllByText('Expertly Manage').length).toBeGreaterThan(0)
  })

  it('displays the tagline pills', () => {
    renderWithRouter(<LandingPage />)
    // "You" appears in tagline pill and three-ring section
    expect(screen.getAllByText('You').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Your best people')).toBeInTheDocument()
    expect(screen.getByText('AI multiplying each one')).toBeInTheDocument()
  })

  it('renders Sign In link', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('renders Get Started button', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('renders Start Free Trial buttons', () => {
    renderWithRouter(<LandingPage />)
    // Appears in hero and CTA sections
    expect(screen.getAllByText('Start Free Trial').length).toBeGreaterThanOrEqual(2)
  })

  it('renders Watch Demo button', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Watch Demo')).toBeInTheDocument()
  })

  it('displays the stats bar with big numbers', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('10x')).toBeInTheDocument()
    expect(screen.getByText('Zero')).toBeInTheDocument()
    expect(screen.getByText('24/7')).toBeInTheDocument()
    expect(screen.getByText('Team output multiplier')).toBeInTheDocument()
    expect(screen.getByText('Tasks falling through cracks')).toBeInTheDocument()
    expect(screen.getByText('AI specialists working for you')).toBeInTheDocument()
  })

  it('renders the three-ring model section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/The future isn't a bigger team/)).toBeInTheDocument()
    expect(screen.getByText(/It's a better one/)).toBeInTheDocument()
  })

  it('displays the three rings - You, Inner Circle, AI Specialists', () => {
    renderWithRouter(<LandingPage />)
    // "You" appears in tagline pill and model section
    expect(screen.getAllByText('You').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Your Inner Circle')).toBeInTheDocument()
    expect(screen.getByText('AI Specialists')).toBeInTheDocument()
  })

  it('displays inner circle role examples', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Sales lead')).toBeInTheDocument()
    expect(screen.getByText('Ops manager')).toBeInTheDocument()
    expect(screen.getByText('Creative director')).toBeInTheDocument()
  })

  it('displays AI specialist examples', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Sales AI')).toBeInTheDocument()
    expect(screen.getByText('Support AI')).toBeInTheDocument()
    expect(screen.getByText('Ops AI')).toBeInTheDocument()
  })

  it('renders the before/after comparison section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('What changes')).toBeInTheDocument()
    expect(screen.getByText('Without Expertly Manage')).toBeInTheDocument()
    expect(screen.getByText('With Expertly Manage')).toBeInTheDocument()
  })

  it('displays before comparison points', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Tasks scattered across 10 different tools')).toBeInTheDocument()
    expect(screen.getByText('Constant context switching kills focus')).toBeInTheDocument()
    expect(screen.getByText('Things fall through cracks weekly')).toBeInTheDocument()
    expect(screen.getByText('Need more headcount to scale')).toBeInTheDocument()
  })

  it('displays after comparison points', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('One unified command center for everything')).toBeInTheDocument()
    expect(screen.getByText('AI gathers context before you even start')).toBeInTheDocument()
    expect(screen.getByText('Automatic follow-ups, nothing forgotten')).toBeInTheDocument()
    expect(screen.getByText('Your 5-person team operates like 15')).toBeInTheDocument()
  })

  it('renders the social proof section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/We went from 12 people drowning in coordination/)).toBeInTheDocument()
    expect(screen.getByText('Engineering Director')).toBeInTheDocument()
    expect(screen.getByText('Series B SaaS Company')).toBeInTheDocument()
  })

  it('renders the How It Works section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText('From scattered chaos to smooth autopilot in four steps')).toBeInTheDocument()
  })

  it('displays the four steps', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Map your processes')).toBeInTheDocument()
    expect(screen.getByText('Deploy AI specialists')).toBeInTheDocument()
    expect(screen.getByText('Unify everything')).toBeInTheDocument()
    expect(screen.getByText('Let AI push forward')).toBeInTheDocument()
  })

  it('renders step numbers', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders the integrations section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Pulls work from everywhere')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Jira')).toBeInTheDocument()
    expect(screen.getByText('Teamwork')).toBeInTheDocument()
    expect(screen.getByText('+ more')).toBeInTheDocument()
  })

  it('renders the CTA section', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('Ready to amplify your team?')).toBeInTheDocument()
    expect(screen.getByText('Book a Demo')).toBeInTheDocument()
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
    const watchDemoLink = screen.getByText('Watch Demo')
    expect(watchDemoLink.closest('a')).toHaveAttribute('href', '#demo')
  })

  it('renders the hero section with proper structure', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText(/A leaner team. Better people/)).toBeInTheDocument()
    expect(screen.getByText(/Each one 10x more effective/)).toBeInTheDocument()
  })
})
