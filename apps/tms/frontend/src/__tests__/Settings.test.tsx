import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Settings from '../pages/Settings'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

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
    // Desktop sidebar and mobile tabs both render, so use getAllByText
    expect(screen.getAllByText('Profile').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Company Info')).toBeInTheDocument()
    expect(screen.getAllByText('Defaults').length).toBeGreaterThanOrEqual(1)
  })

  it('switches tabs when clicked', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    // Click company info tab (desktop sidebar has unique "Company Info" text)
    fireEvent.click(screen.getByText('Company Info'))
    expect(screen.getByText('Company Information')).toBeInTheDocument()

    // Click defaults tab
    const defaultsButtons = screen.getAllByText('Defaults')
    fireEvent.click(defaultsButtons[defaultsButtons.length - 1])
    expect(screen.getByText('Default Settings')).toBeInTheDocument()

    // Click profile tab back
    const profileButtons = screen.getAllByText('Profile')
    fireEvent.click(profileButtons[profileButtons.length - 1])
    expect(screen.getByText('Profile Settings')).toBeInTheDocument()
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

    const defaultsButtons = screen.getAllByText('Defaults')
    fireEvent.click(defaultsButtons[defaultsButtons.length - 1])
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
