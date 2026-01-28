import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      user: { organization_id: 'org-123', email: 'test@example.com' },
      access_token: 'token-123',
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
})
