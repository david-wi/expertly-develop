import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('renders the navigation', () => {
    render(<LandingPage />)

    // Multiple Expertly Vibecode texts exist (header and footer)
    expect(screen.getAllByText('Expertly Vibecode').length).toBeGreaterThan(0)
    expect(screen.getByText('Download Agent')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('renders the hero section', () => {
    render(<LandingPage />)

    expect(screen.getByText(/Multi-Agent AI Coding/)).toBeInTheDocument()
    expect(screen.getByText('Reimagined')).toBeInTheDocument()
    expect(
      screen.getByText(/A powerful dashboard for managing multiple AI coding sessions/)
    ).toBeInTheDocument()
  })

  it('renders launch dashboard button', () => {
    render(<LandingPage />)

    // Multiple Launch Dashboard buttons exist (hero and CTA)
    expect(screen.getAllByText('Launch Dashboard').length).toBeGreaterThan(0)
    expect(screen.getByText('See Features')).toBeInTheDocument()
  })

  it('renders benefits bar', () => {
    render(<LandingPage />)

    expect(screen.getByText('Parallel AI sessions')).toBeInTheDocument()
    expect(screen.getByText('Real-time streaming')).toBeInTheDocument()
    expect(screen.getByText('Context-aware assistance')).toBeInTheDocument()
    expect(screen.getByText('Customizable layout')).toBeInTheDocument()
    expect(screen.getByText('Code syntax highlighting')).toBeInTheDocument()
    expect(screen.getByText('Markdown rendering')).toBeInTheDocument()
  })

  it('renders features section', () => {
    render(<LandingPage />)

    expect(
      screen.getByText('Everything you need for AI-powered coding')
    ).toBeInTheDocument()
    expect(screen.getByText('Multi-Agent Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Real-Time Collaboration')).toBeInTheDocument()
    expect(screen.getByText('AI Code Generation')).toBeInTheDocument()
    expect(screen.getByText('Multiple AI Assistants')).toBeInTheDocument()
    expect(screen.getByText('WebSocket Connections')).toBeInTheDocument()
    expect(screen.getByText('Widget System')).toBeInTheDocument()
  })

  it('renders how it works section', () => {
    render(<LandingPage />)

    expect(
      screen.getByText('Start coding with AI in three steps')
    ).toBeInTheDocument()
    expect(screen.getByText('Create a Widget')).toBeInTheDocument()
    expect(screen.getByText('Start Chatting')).toBeInTheDocument()
    expect(screen.getByText('Organize & Scale')).toBeInTheDocument()
  })

  it('renders CTA section', () => {
    render(<LandingPage />)

    expect(
      screen.getByText('Ready to supercharge your coding workflow?')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Join developers who are building faster with multi-agent AI assistance.'
      )
    ).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(<LandingPage />)

    expect(screen.getByText('Part of the Expertly suite of products.')).toBeInTheDocument()
  })

  it('has correct navigation links', () => {
    render(<LandingPage />)

    const downloadLink = screen.getByText('Download Agent')
    expect(downloadLink.closest('a')).toHaveAttribute('href', '/download')

    const getStartedLink = screen.getByText('Get Started')
    expect(getStartedLink.closest('a')).toHaveAttribute('href', '/')
  })
})
