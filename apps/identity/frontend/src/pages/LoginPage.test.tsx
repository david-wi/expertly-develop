import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn(),
  },
  setOrganizationId: vi.fn(),
}))

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('renders login form', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: /expertly/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows email input', () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('shows password input', () => {
    render(<LoginPage />)

    const passwordInput = screen.getByPlaceholderText(/enter your password/i)
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('allows entering email and password', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const passwordInput = screen.getByPlaceholderText(/enter your password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('shows forgot password link', () => {
    render(<LoginPage />)

    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('shows magic code sign in option', () => {
    render(<LoginPage />)

    expect(screen.getByRole('link', { name: /sign in with email code/i })).toBeInTheDocument()
  })

  it('shows loading state when submitting', async () => {
    const { authApi } = await import('../services/api')
    const mockLogin = vi.mocked(authApi.login)
    mockLogin.mockImplementation(() => new Promise(() => {})) // Never resolves

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/enter your password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })

  it('shows error message on login failure', async () => {
    const { authApi } = await import('../services/api')
    const mockLogin = vi.mocked(authApi.login)
    mockLogin.mockRejectedValue({
      response: { data: { detail: 'Invalid credentials' } },
    })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/enter your password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('navigates to home on successful login', async () => {
    const { authApi, setOrganizationId } = await import('../services/api')
    const mockLogin = vi.mocked(authApi.login)
    mockLogin.mockResolvedValue({
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        organization_id: 'org-123',
        organization_name: 'Test Org',
        role: 'member',
        avatar_url: null,
      },
      session_token: 'token-123',
      expires_at: '2026-12-31T00:00:00Z',
    })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/enter your password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(setOrganizationId).toHaveBeenCalledWith('org-123')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('Return URL Redirect', () => {
    const mockLoginResponse = {
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        organization_id: 'org-123',
        organization_name: 'Test Org',
        role: 'member',
        avatar_url: null,
      },
      session_token: 'token-123',
      expires_at: '2026-12-31T00:00:00Z',
    }

    let originalLocation: Location

    beforeEach(() => {
      // Save original location
      originalLocation = window.location
      // Mock window.location
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, href: '' },
        writable: true,
      })
    })

    afterEach(() => {
      // Restore original location
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
        writable: true,
      })
    })

    it('redirects to return_url (snake_case) after successful login', async () => {
      const { authApi } = await import('../services/api')
      const mockLogin = vi.mocked(authApi.login)
      mockLogin.mockResolvedValue(mockLoginResponse)

      // Set snake_case return_url parameter
      mockSearchParams = new URLSearchParams('return_url=https://vibetest.ai.devintensive.com')

      const user = userEvent.setup()
      render(<LoginPage />)

      await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
      await user.type(screen.getByPlaceholderText(/enter your password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(window.location.href).toBe('https://vibetest.ai.devintensive.com')
      })
      // Should NOT navigate internally when redirecting externally
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('redirects to returnUrl (camelCase) after successful login', async () => {
      const { authApi } = await import('../services/api')
      const mockLogin = vi.mocked(authApi.login)
      mockLogin.mockResolvedValue(mockLoginResponse)

      // Set camelCase returnUrl parameter
      mockSearchParams = new URLSearchParams('returnUrl=https://manage.ai.devintensive.com')

      const user = userEvent.setup()
      render(<LoginPage />)

      await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
      await user.type(screen.getByPlaceholderText(/enter your password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(window.location.href).toBe('https://manage.ai.devintensive.com')
      })
      // Should NOT navigate internally when redirecting externally
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows redirect notice when return_url is present', () => {
      mockSearchParams = new URLSearchParams('return_url=https://vibetest.ai.devintensive.com')
      render(<LoginPage />)

      expect(screen.getByText(/you'll be redirected back after signing in/i)).toBeInTheDocument()
    })

    it('shows redirect notice when returnUrl is present', () => {
      mockSearchParams = new URLSearchParams('returnUrl=https://vibetest.ai.devintensive.com')
      render(<LoginPage />)

      expect(screen.getByText(/you'll be redirected back after signing in/i)).toBeInTheDocument()
    })

    it('passes return_url to magic code link', () => {
      mockSearchParams = new URLSearchParams('return_url=https://vibetest.ai.devintensive.com')
      render(<LoginPage />)

      const magicCodeLink = screen.getByRole('link', { name: /sign in with email code/i })
      expect(magicCodeLink).toHaveAttribute('href', expect.stringContaining('return_url='))
    })

    it('passes returnUrl to magic code link', () => {
      mockSearchParams = new URLSearchParams('returnUrl=https://vibetest.ai.devintensive.com')
      render(<LoginPage />)

      const magicCodeLink = screen.getByRole('link', { name: /sign in with email code/i })
      expect(magicCodeLink).toHaveAttribute('href', expect.stringContaining('return_url='))
    })
  })
})
