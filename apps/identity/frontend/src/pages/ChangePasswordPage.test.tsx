import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import ChangePasswordPage from './ChangePasswordPage'

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}))

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders change password form', () => {
    render(<ChangePasswordPage />)

    expect(screen.getByRole('heading', { name: /expertly/i })).toBeInTheDocument()
    expect(screen.getByText(/change your password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument()
  })

  it('shows password requirements', () => {
    render(<ChangePasswordPage />)

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows back to home link', () => {
    render(<ChangePasswordPage />)

    expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument()
  })

  it('allows entering passwords', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    const currentPassword = screen.getByLabelText(/current password/i)
    const newPassword = screen.getByLabelText(/^new password$/i)
    const confirmPassword = screen.getByLabelText(/confirm new password/i)

    await user.type(currentPassword, 'OldPassword123!')
    await user.type(newPassword, 'NewPassword123!')
    await user.type(confirmPassword, 'NewPassword123!')

    expect(currentPassword).toHaveValue('OldPassword123!')
    expect(newPassword).toHaveValue('NewPassword123!')
    expect(confirmPassword).toHaveValue('NewPassword123!')
  })

  it('shows error when new passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPassword123!')
    await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm new password/i), 'DifferentPassword!')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/new passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows error when new password is same as current', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText(/current password/i), 'SamePassword123!')
    await user.type(screen.getByLabelText(/^new password$/i), 'SamePassword123!')
    await user.type(screen.getByLabelText(/confirm new password/i), 'SamePassword123!')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/new password must be different/i)).toBeInTheDocument()
    })
  })

  it('shows loading state when submitting', async () => {
    const { authApi } = await import('../services/api')
    const mockChangePassword = vi.mocked(authApi.changePassword)
    mockChangePassword.mockImplementation(() => new Promise(() => {})) // Never resolves

    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPassword123!')
    await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/changing/i)).toBeInTheDocument()
    })
  })

  it('shows success message on successful change', async () => {
    const { authApi } = await import('../services/api')
    const mockChangePassword = vi.mocked(authApi.changePassword)
    mockChangePassword.mockResolvedValue({ message: 'Password changed' })

    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPassword123!')
    await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/password changed/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument()
    })
  })

  it('shows error message on change failure', async () => {
    const { authApi } = await import('../services/api')
    const mockChangePassword = vi.mocked(authApi.changePassword)
    mockChangePassword.mockRejectedValue({
      response: { data: { detail: 'Current password is incorrect' } },
    })

    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText(/current password/i), 'WrongPassword!')
    await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword123!')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument()
    })
  })

  it('shows password validation errors', async () => {
    const { authApi } = await import('../services/api')
    const mockChangePassword = vi.mocked(authApi.changePassword)
    mockChangePassword.mockRejectedValue({
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
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPassword123!')
    await user.type(screen.getByLabelText(/^new password$/i), 'weak')
    await user.type(screen.getByLabelText(/confirm new password/i), 'weak')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument()
      expect(screen.getByText(/must contain a number/i)).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    const currentPassword = screen.getByLabelText(/current password/i)
    expect(currentPassword).toHaveAttribute('type', 'password')

    // Find and click the toggle button
    const toggleButtons = screen.getAllByRole('button')
    const eyeButton = toggleButtons.find(btn => btn.querySelector('svg'))
    if (eyeButton) {
      await user.click(eyeButton)
    }

    await waitFor(() => {
      expect(currentPassword).toHaveAttribute('type', 'text')
    })
  })
})
