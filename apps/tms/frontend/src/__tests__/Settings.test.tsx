import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Settings from '../pages/Settings'

describe('Settings', () => {
  it('renders settings heading', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
  })

  it('displays tab navigation', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Company Info')).toBeInTheDocument()
    expect(screen.getByText('Defaults')).toBeInTheDocument()
  })

  it('switches tabs when clicked', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    // Click notifications tab
    fireEvent.click(screen.getByText('Notifications'))
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument()

    // Click company info tab
    fireEvent.click(screen.getByText('Company Info'))
    expect(screen.getByText('Company Information')).toBeInTheDocument()

    // Click defaults tab
    fireEvent.click(screen.getByText('Defaults'))
    expect(screen.getByText('Default Settings')).toBeInTheDocument()
  })

  it('renders profile settings by default', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )
    expect(screen.getByText('Profile Settings')).toBeInTheDocument()
  })

  it('shows MC Number and DOT Number fields in company tab', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    fireEvent.click(screen.getByText('Company Info'))
    expect(screen.getByText('MC Number')).toBeInTheDocument()
    expect(screen.getByText('DOT Number')).toBeInTheDocument()
  })

  it('shows default margin and equipment type in defaults tab', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    fireEvent.click(screen.getByText('Defaults'))
    expect(screen.getByText('Default Margin %')).toBeInTheDocument()
    expect(screen.getByText('Default Equipment Type')).toBeInTheDocument()
  })

  it('has save button', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})
