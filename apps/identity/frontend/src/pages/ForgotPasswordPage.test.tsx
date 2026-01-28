import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from './ForgotPasswordPage'

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    forgotPassword: vi.fn(),
  },
}))

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders forgot password form', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByRole('heading', { name: /expertly/i })).toBeInTheDocument()
    // Use getAllByText since "reset your password" appears in multiple places
    expect(screen.getAllByText(/reset your password/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('shows email input with correct attributes', () => {
    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('allows entering email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    await user.type(emailInput, 'test@example.com')

    expect(emailInput).toHaveValue('test@example.com')
  })

  it('shows back to sign in link', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
  })

  it('shows loading state when submitting', async () => {
    const { authApi } = await import('../services/api')
    const mockForgotPassword = vi.mocked(authApi.forgotPassword)
    mockForgotPassword.mockImplementation(() => new Promise(() => {})) // Never resolves

    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/sending/i)).toBeInTheDocument()
    })
  })

  it('shows success message on successful submission', async () => {
    const { authApi } = await import('../services/api')
    const mockForgotPassword = vi.mocked(authApi.forgotPassword)
    mockForgotPassword.mockResolvedValue({ message: 'Email sent' })

    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
      expect(screen.getByText(/test@example.com/i)).toBeInTheDocument()
    })
  })

  it('shows error message on failure', async () => {
    const { authApi } = await import('../services/api')
    const mockForgotPassword = vi.mocked(authApi.forgotPassword)
    mockForgotPassword.mockRejectedValue({
      response: { data: { detail: 'Email not found' } },
    })

    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/email not found/i)).toBeInTheDocument()
    })
  })

  it('shows generic error message on unknown failure', async () => {
    const { authApi } = await import('../services/api')
    const mockForgotPassword = vi.mocked(authApi.forgotPassword)
    mockForgotPassword.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument()
    })
  })
})
