import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import MagicCodePage from './MagicCodePage'

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    requestMagicCode: vi.fn(),
    verifyMagicCode: vi.fn(),
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

describe('MagicCodePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Email Step', () => {
    it('renders email form', () => {
      render(<MagicCodePage />)

      expect(screen.getByRole('heading', { name: /expertly/i })).toBeInTheDocument()
      expect(screen.getByText(/sign in with email code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send login code/i })).toBeInTheDocument()
    })

    it('shows expertly email notice', () => {
      render(<MagicCodePage />)

      expect(screen.getByText(/@expertly.com/i)).toBeInTheDocument()
    })

    it('allows entering email', async () => {
      const user = userEvent.setup()
      render(<MagicCodePage />)

      const emailInput = screen.getByPlaceholderText(/you@expertly.com/i)
      await user.type(emailInput, 'test@expertly.com')

      expect(emailInput).toHaveValue('test@expertly.com')
    })

    it('shows back to password login link', () => {
      render(<MagicCodePage />)

      expect(screen.getByRole('link', { name: /sign in with password instead/i })).toBeInTheDocument()
    })

    it('shows loading state when requesting code', async () => {
      const { authApi } = await import('../services/api')
      const mockRequestMagicCode = vi.mocked(authApi.requestMagicCode)
      mockRequestMagicCode.mockImplementation(() => new Promise(() => {})) // Never resolves

      const user = userEvent.setup()
      render(<MagicCodePage />)

      await user.type(screen.getByPlaceholderText(/you@expertly.com/i), 'test@expertly.com')
      await user.click(screen.getByRole('button', { name: /send login code/i }))

      await waitFor(() => {
        expect(screen.getByText(/sending code/i)).toBeInTheDocument()
      })
    })

    it('advances to code step on successful request', async () => {
      const { authApi } = await import('../services/api')
      const mockRequestMagicCode = vi.mocked(authApi.requestMagicCode)
      mockRequestMagicCode.mockResolvedValue({ message: 'Code sent', expires_in_minutes: 15 })

      const user = userEvent.setup()
      render(<MagicCodePage />)

      await user.type(screen.getByPlaceholderText(/you@expertly.com/i), 'test@expertly.com')
      await user.click(screen.getByRole('button', { name: /send login code/i }))

      await waitFor(() => {
        expect(screen.getByText(/enter the 6-character code/i)).toBeInTheDocument()
      })
    })

    it('shows error on request failure', async () => {
      const { authApi } = await import('../services/api')
      const mockRequestMagicCode = vi.mocked(authApi.requestMagicCode)
      mockRequestMagicCode.mockRejectedValue({
        response: { data: { detail: 'Email not allowed' } },
      })

      const user = userEvent.setup()
      render(<MagicCodePage />)

      await user.type(screen.getByPlaceholderText(/you@expertly.com/i), 'test@example.com')
      await user.click(screen.getByRole('button', { name: /send login code/i }))

      await waitFor(() => {
        expect(screen.getByText(/email not allowed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Code Step', () => {
    const setupCodeStep = async () => {
      const { authApi } = await import('../services/api')
      const mockRequestMagicCode = vi.mocked(authApi.requestMagicCode)
      mockRequestMagicCode.mockResolvedValue({ message: 'Code sent', expires_in_minutes: 15 })

      const user = userEvent.setup()
      render(<MagicCodePage />)

      await user.type(screen.getByPlaceholderText(/you@expertly.com/i), 'test@expertly.com')
      await user.click(screen.getByRole('button', { name: /send login code/i }))

      await waitFor(() => {
        expect(screen.getByText(/enter the 6-character code/i)).toBeInTheDocument()
      })

      return { user, authApi }
    }

    it('shows code sent confirmation', async () => {
      await setupCodeStep()

      expect(screen.getByText(/code sent to test@expertly.com/i)).toBeInTheDocument()
    })

    it('shows 6 code input fields', async () => {
      await setupCodeStep()

      const inputs = screen.getAllByRole('textbox')
      expect(inputs).toHaveLength(6)
    })

    it('allows entering code', async () => {
      const { user } = await setupCodeStep()

      const inputs = screen.getAllByRole('textbox')
      await user.type(inputs[0], 'A')
      await user.type(inputs[1], 'B')
      await user.type(inputs[2], 'C')
      await user.type(inputs[3], '1')
      await user.type(inputs[4], '2')
      await user.type(inputs[5], '3')

      expect(inputs[0]).toHaveValue('A')
      expect(inputs[1]).toHaveValue('B')
      expect(inputs[2]).toHaveValue('C')
      expect(inputs[3]).toHaveValue('1')
      expect(inputs[4]).toHaveValue('2')
      expect(inputs[5]).toHaveValue('3')
    })

    it('shows change email button', async () => {
      await setupCodeStep()

      expect(screen.getByRole('button', { name: /change email/i })).toBeInTheDocument()
    })

    it('shows resend code button', async () => {
      await setupCodeStep()

      expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument()
    })

    it('navigates home on successful verification', async () => {
      const { user, authApi } = await setupCodeStep()
      const mockVerifyMagicCode = vi.mocked(authApi.verifyMagicCode)
      mockVerifyMagicCode.mockResolvedValue({
        session_token: 'token-123',
        expires_at: '2026-12-31T00:00:00Z',
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@expertly.com',
          organization_id: 'org-123',
          organization_name: 'Test Org',
          role: 'member',
          avatar_url: null,
        },
      })

      const inputs = screen.getAllByRole('textbox')
      await user.type(inputs[0], 'ABC123')

      await user.click(screen.getByRole('button', { name: /verify code/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('shows error on verification failure', async () => {
      const { user, authApi } = await setupCodeStep()
      const mockVerifyMagicCode = vi.mocked(authApi.verifyMagicCode)
      mockVerifyMagicCode.mockRejectedValue({
        response: { data: { detail: 'Invalid code' } },
      })

      const inputs = screen.getAllByRole('textbox')
      await user.type(inputs[0], 'ABC123')

      await user.click(screen.getByRole('button', { name: /verify code/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid code/i)).toBeInTheDocument()
      })
    })

    it('returns to email step when change email is clicked', async () => {
      const { user } = await setupCodeStep()

      await user.click(screen.getByRole('button', { name: /change email/i }))

      await waitFor(() => {
        expect(screen.getByText(/sign in with email code/i)).toBeInTheDocument()
      })
    })
  })
})
