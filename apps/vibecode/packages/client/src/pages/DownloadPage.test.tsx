import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DownloadPage from './DownloadPage'

describe('DownloadPage', () => {
  it('renders the navigation', () => {
    render(<DownloadPage />)

    // Multiple Expertly Vibecode texts exist (header and footer)
    expect(screen.getAllByText('Expertly Vibecode').length).toBeGreaterThan(0)
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Open Dashboard')).toBeInTheDocument()
  })

  it('renders hero section', () => {
    render(<DownloadPage />)

    expect(screen.getByText('Desktop Agent')).toBeInTheDocument()
    expect(screen.getByText(/Run AI tools on your/)).toBeInTheDocument()
    expect(screen.getByText('local machine')).toBeInTheDocument()
    expect(
      screen.getByText(
        /The Vibecode Desktop Agent connects to the dashboard and executes file operations/
      )
    ).toBeInTheDocument()
  })

  it('renders download section header', () => {
    render(<DownloadPage />)

    expect(screen.getByText('Download for your platform')).toBeInTheDocument()
  })

  it('renders platform sections', () => {
    render(<DownloadPage />)

    expect(screen.getByText('macOS')).toBeInTheDocument()
    expect(screen.getByText('Windows')).toBeInTheDocument()
    expect(screen.getByText('Linux')).toBeInTheDocument()
  })

  it('renders macOS download options', () => {
    render(<DownloadPage />)

    expect(screen.getByText('Apple Silicon')).toBeInTheDocument()
    expect(screen.getByText('Intel')).toBeInTheDocument()
  })

  it('shows coming soon for unavailable platforms', () => {
    render(<DownloadPage />)

    const comingSoonTexts = screen.getAllByText('Coming soon')
    expect(comingSoonTexts.length).toBeGreaterThan(0)
  })

  it('renders features section', () => {
    render(<DownloadPage />)

    expect(screen.getByText('Why use the desktop agent?')).toBeInTheDocument()
    expect(screen.getByText('Native Performance')).toBeInTheDocument()
    expect(screen.getByText('Resource Aware')).toBeInTheDocument()
    expect(screen.getByText('System Tray')).toBeInTheDocument()
    expect(screen.getByText('Auto Updates')).toBeInTheDocument()
  })

  it('renders available tools section', () => {
    render(<DownloadPage />)

    expect(screen.getByText('Available tools')).toBeInTheDocument()
    expect(screen.getByText(/read_file - Read any file/)).toBeInTheDocument()
    expect(screen.getByText(/write_file - Create or update/)).toBeInTheDocument()
    expect(screen.getByText(/list_files - Browse directories/)).toBeInTheDocument()
    expect(screen.getByText(/run_command - Execute shell/)).toBeInTheDocument()
    expect(screen.getByText(/search_files - Search file/)).toBeInTheDocument()
  })

  it('renders quick start section', () => {
    render(<DownloadPage />)

    expect(screen.getByText('Quick start')).toBeInTheDocument()
    expect(screen.getByText('Download and install')).toBeInTheDocument()
    expect(screen.getByText('Configure settings')).toBeInTheDocument()
    expect(screen.getByText('Connect and code')).toBeInTheDocument()
  })

  it('renders macOS security note', () => {
    render(<DownloadPage />)

    expect(screen.getByText('macOS Security Note')).toBeInTheDocument()
    expect(
      screen.getByText(/If macOS shows "app is damaged"/)
    ).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(<DownloadPage />)

    expect(
      screen.getByText('Part of the Expertly suite of products.')
    ).toBeInTheDocument()
  })

  it('has correct back link', () => {
    render(<DownloadPage />)

    const backLink = screen.getByText('Back')
    expect(backLink.closest('a')).toHaveAttribute('href', '/landing')
  })

  it('has correct dashboard link', () => {
    render(<DownloadPage />)

    const dashboardLink = screen.getByText('Open Dashboard')
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/')
  })
})
