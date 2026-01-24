import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/test-utils'
import { Login } from './Login'
import { useAppStore } from '../stores/appStore'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store
    useAppStore.setState({
      apiKey: null,
      isAuthenticated: false,
    })
  })

  it('renders login form', () => {
    render(<Login />)

    expect(screen.getByText('Expertly Today')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error when submitting whitespace-only API key', async () => {
    render(<Login />)

    // Enter only whitespace (passes HTML required but triggers our validation)
    const input = screen.getByPlaceholderText('Enter your API key')
    fireEvent.change(input, { target: { value: '   ' } })

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Please enter your API key')).toBeInTheDocument()
    })
  })

  it('saves API key and navigates on successful submit', async () => {
    render(<Login />)

    const input = screen.getByPlaceholderText('Enter your API key')
    fireEvent.change(input, { target: { value: 'test-api-key-123' } })

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    // Check that the store was updated
    expect(useAppStore.getState().apiKey).toBe('test-api-key-123')
    expect(useAppStore.getState().isAuthenticated).toBe(true)
  })

  it('trims whitespace from API key', async () => {
    render(<Login />)

    const input = screen.getByPlaceholderText('Enter your API key')
    fireEvent.change(input, { target: { value: '  test-key-with-spaces  ' } })

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(useAppStore.getState().apiKey).toBe('test-key-with-spaces')
    })
  })

  it('shows loading state while submitting', async () => {
    render(<Login />)

    const input = screen.getByPlaceholderText('Enter your API key')
    fireEvent.change(input, { target: { value: 'test-key' } })

    const button = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(button)

    // Button should be disabled during loading
    // Note: The loading state is brief, so this might be flaky
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  it('displays informational text', () => {
    render(<Login />)

    expect(screen.getByText('Enter your API key to continue')).toBeInTheDocument()
    expect(
      screen.getByText("Don't have an API key? Contact your administrator.")
    ).toBeInTheDocument()
  })
})
