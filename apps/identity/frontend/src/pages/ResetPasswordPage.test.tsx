import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPasswordPage from './ResetPasswordPage'

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    resetPassword: vi.fn(),
  },
}))

// Custom render with route params - using rtlRender directly to avoid double-wrapping
const renderWithRoute = (route: string) => {
  return rtlRender(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Invalid link state', () => {
    it('shows invalid link message when token is missing', () => {
      renderWithRoute('/reset-password?email=test@example.com')

      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /request a new reset link/i })).toBeInTheDocument()
    })

    it('shows invalid link message when email is missing', () => {
      renderWithRoute('/reset-password?token=abc123')

      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument()
    })

    it('shows invalid link message when both are missing', () => {
      renderWithRoute('/reset-password')

      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument()
    })
  })

  describe('Reset form', () => {
    const validRoute = '/reset-password?token=valid-token&email=test@example.com'

    it('renders reset password form with valid params', () => {
      renderWithRoute(validRoute)

      expect(screen.getByRole('heading', { name: /expertly/i })).toBeInTheDocument()
      expect(screen.getByText(/create a new password/i)).toBeInTheDocument()
      // Use placeholder to find specific inputs
      expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/confirm new password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
    })

    it('shows email being reset', () => {
      renderWithRoute(validRoute)

      expect(screen.getByText(/test@example.com/i)).toBeInTheDocument()
    })

    it('shows password requirements', () => {
      renderWithRoute(validRoute)

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })

    it('allows entering passwords', async () => {
      const user = userEvent.setup()
      renderWithRoute(validRoute)

      const passwordInput = screen.getByPlaceholderText(/enter new password/i)
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i)

      await user.type(passwordInput, 'NewPassword123!')
      await user.type(confirmInput, 'NewPassword123!')

      expect(passwordInput).toHaveValue('NewPassword123!')
      expect(confirmInput).toHaveValue('NewPassword123!')
    })

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup()
      renderWithRoute(validRoute)

      await user.type(screen.getByPlaceholderText(/enter new password/i), 'NewPassword123!')
      await user.type(screen.getByPlaceholderText(/confirm new password/i), 'DifferentPassword!')
      await user.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })

    it('shows loading state when submitting', async () => {
      const { authApi } = await import('../services/api')
      const mockResetPassword = vi.mocked(authApi.resetPassword)
      mockResetPassword.mockImplementation(() => new Promise(() => {})) // Never resolves

      const user = userEvent.setup()
      renderWithRoute(validRoute)

      await user.type(screen.getByPlaceholderText(/enter new password/i), 'NewPassword123!')
      await user.type(screen.getByPlaceholderText(/confirm new password/i), 'NewPassword123!')
      await user.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        // Look for the button showing loading state
        expect(screen.getByRole('button', { name: /resetting/i })).toBeInTheDocument()
      })
    })

    it('shows success message on successful reset', async () => {
      const { authApi } = await import('../services/api')
      const mockResetPassword = vi.mocked(authApi.resetPassword)
      mockResetPassword.mockResolvedValue({ message: 'Password reset' })

      const user = userEvent.setup()
      renderWithRoute(validRoute)

      await user.type(screen.getByPlaceholderText(/enter new password/i), 'NewPassword123!')
      await user.type(screen.getByPlaceholderText(/confirm new password/i), 'NewPassword123!')
      await user.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /password reset/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /sign in with new password/i })).toBeInTheDocument()
      })
    })

    it('shows error message on reset failure', async () => {
      const { authApi } = await import('../services/api')
      const mockResetPassword = vi.mocked(authApi.resetPassword)
      mockResetPassword.mockRejectedValue({
        response: { data: { detail: 'Token expired' } },
      })

      const user = userEvent.setup()
      renderWithRoute(validRoute)

      await user.type(screen.getByPlaceholderText(/enter new password/i), 'NewPassword123!')
      await user.type(screen.getByPlaceholderText(/confirm new password/i), 'NewPassword123!')
      await user.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(screen.getByText(/token expired/i)).toBeInTheDocument()
      })
    })

    it('shows password validation errors', async () => {
      const { authApi } = await import('../services/api')
      const mockResetPassword = vi.mocked(authApi.resetPassword)
      mockResetPassword.mockRejectedValue({
        response: {
          data: {
            detail: {
              message: 'Password does not meet requirements',
              errors: ['Must be at least 8 characters', 'Must contain a number'],
            },
          },
        },
      })

      const user = userEvent.setup()
      renderWithRoute(validRoute)

      await user.type(screen.getByPlaceholderText(/enter new password/i), 'weak')
      await user.type(screen.getByPlaceholderText(/confirm new password/i), 'weak')
      await user.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument()
        expect(screen.getByText(/must contain a number/i)).toBeInTheDocument()
      })
    })

    it('toggles password visibility', async () => {
      const user = userEvent.setup()
      renderWithRoute(validRoute)

      const passwordInput = screen.getByPlaceholderText(/enter new password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')

      // Find and click the toggle button (the first button with svg that's not the submit button)
      const toggleButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('svg'))
      if (toggleButtons.length > 0) {
        await user.click(toggleButtons[0])
      }

      await waitFor(() => {
        expect(passwordInput).toHaveAttribute('type', 'text')
      })
    })
  })
})
