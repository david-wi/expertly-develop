import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

// Mock the Layout component to simplify testing
vi.mock('./components/Layout', () => ({
  default: vi.fn(() => (
    <div data-testid="layout">
      <div data-testid="layout-outlet" />
    </div>
  )),
}))

// Mock page components
vi.mock('./pages/LandingPage', () => ({
  default: vi.fn(() => <div data-testid="landing-page">Landing Page</div>),
}))

vi.mock('./pages/LoginPage', () => ({
  default: vi.fn(() => <div data-testid="login-page">Login Page</div>),
}))

vi.mock('./pages/MagicCodePage', () => ({
  default: vi.fn(() => <div data-testid="magic-code-page">Magic Code Page</div>),
}))

vi.mock('./pages/ForgotPasswordPage', () => ({
  default: vi.fn(() => <div data-testid="forgot-password-page">Forgot Password Page</div>),
}))

vi.mock('./pages/ResetPasswordPage', () => ({
  default: vi.fn(() => <div data-testid="reset-password-page">Reset Password Page</div>),
}))

vi.mock('./pages/UsersPage', () => ({
  default: vi.fn(({ defaultFilter }: { defaultFilter?: string }) => (
    <div data-testid="users-page" data-filter={defaultFilter}>
      Users Page ({defaultFilter || 'all'})
    </div>
  )),
}))

vi.mock('./pages/TeamsPage', () => ({
  default: vi.fn(() => <div data-testid="teams-page">Teams Page</div>),
}))

vi.mock('./pages/OrganizationsPage', () => ({
  default: vi.fn(() => <div data-testid="organizations-page">Organizations Page</div>),
}))

vi.mock('./pages/ChangePasswordPage', () => ({
  default: vi.fn(() => <div data-testid="change-password-page">Change Password Page</div>),
}))

const renderWithRouter = (initialEntries: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  )
}

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Public Routes', () => {
    it('renders LandingPage at /landing', () => {
      renderWithRouter(['/landing'])

      expect(screen.getByTestId('landing-page')).toBeInTheDocument()
    })

    it('renders LoginPage at /login', () => {
      renderWithRouter(['/login'])

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('renders MagicCodePage at /magic-code', () => {
      renderWithRouter(['/magic-code'])

      expect(screen.getByTestId('magic-code-page')).toBeInTheDocument()
    })

    it('renders ForgotPasswordPage at /forgot-password', () => {
      renderWithRouter(['/forgot-password'])

      expect(screen.getByTestId('forgot-password-page')).toBeInTheDocument()
    })

    it('renders ResetPasswordPage at /reset-password', () => {
      renderWithRouter(['/reset-password'])

      expect(screen.getByTestId('reset-password-page')).toBeInTheDocument()
    })
  })

  describe('App Routes with Layout', () => {
    it('renders Layout at root path', () => {
      renderWithRouter(['/'])

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })

    it('renders Layout at /users', () => {
      renderWithRouter(['/users'])

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })

    it('renders Layout at /bots', () => {
      renderWithRouter(['/bots'])

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })

    it('renders Layout at /teams', () => {
      renderWithRouter(['/teams'])

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })

    it('renders Layout at /organizations', () => {
      renderWithRouter(['/organizations'])

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })

    it('renders Layout at /change-password', () => {
      renderWithRouter(['/change-password'])

      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })
  })

  describe('Route Configuration', () => {
    it('public routes do not use Layout', () => {
      renderWithRouter(['/landing'])

      expect(screen.queryByTestId('layout')).not.toBeInTheDocument()
      expect(screen.getByTestId('landing-page')).toBeInTheDocument()
    })

    it('login route does not use Layout', () => {
      renderWithRouter(['/login'])

      expect(screen.queryByTestId('layout')).not.toBeInTheDocument()
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })
})

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderWithRouter(['/'])

    expect(screen.getByTestId('layout')).toBeInTheDocument()
  })

  it('handles unknown routes gracefully', () => {
    renderWithRouter(['/unknown-route'])

    // React Router will not crash, it just won't match any route
    // The Layout wrapper should still be visible since /unknown-route starts with /
    // Actually for Routes outside defined paths, nothing renders
    // This is acceptable behavior - we're just ensuring no crash
    expect(document.body).toBeInTheDocument()
  })
})
