import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { act } from '@testing-library/react'

// Mock the API module
vi.mock('../services/api', () => ({
  auth: {
    me: vi.fn(),
  },
  salon: {
    getCurrent: vi.fn(),
  },
}))

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAuthStore.setState({
      user: null,
      salon: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  it('has correct initial state', () => {
    const state = useAuthStore.getState()

    expect(state.user).toBeNull()
    expect(state.salon).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('checkAuth sets authenticated state on success', async () => {
    const { auth, salon } = await import('../services/api')
    const mockMe = vi.mocked(auth.me)
    const mockGetCurrent = vi.mocked(salon.getCurrent)

    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
    const mockSalon = { id: '1', name: 'Test Salon' }

    mockMe.mockResolvedValue(mockUser)
    mockGetCurrent.mockResolvedValue(mockSalon)

    await act(async () => {
      await useAuthStore.getState().checkAuth()
    })

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('checkAuth sets unauthenticated state on failure', async () => {
    const { auth } = await import('../services/api')
    const mockMe = vi.mocked(auth.me)

    mockMe.mockRejectedValue(new Error('Unauthorized'))

    await act(async () => {
      await useAuthStore.getState().checkAuth()
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('loadUser updates user and authentication state', async () => {
    const { auth, salon } = await import('../services/api')
    const mockMe = vi.mocked(auth.me)
    const mockGetCurrent = vi.mocked(salon.getCurrent)

    const mockUser = { id: '1', email: 'user@example.com', name: 'User' }
    const mockSalon = { id: '1', name: 'Salon' }

    mockMe.mockResolvedValue(mockUser)
    mockGetCurrent.mockResolvedValue(mockSalon)

    await act(async () => {
      await useAuthStore.getState().loadUser()
    })

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('loadSalon updates salon state', async () => {
    const { salon } = await import('../services/api')
    const mockGetCurrent = vi.mocked(salon.getCurrent)

    const mockSalon = { id: '1', name: 'Test Salon', address: '123 Main St' }
    mockGetCurrent.mockResolvedValue(mockSalon)

    await act(async () => {
      await useAuthStore.getState().loadSalon()
    })

    const state = useAuthStore.getState()
    expect(state.salon).toEqual(mockSalon)
  })

  it('loadSalon handles errors gracefully', async () => {
    const { salon } = await import('../services/api')
    const mockGetCurrent = vi.mocked(salon.getCurrent)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetCurrent.mockRejectedValue(new Error('Network error'))

    await act(async () => {
      await useAuthStore.getState().loadSalon()
    })

    // Should not throw, salon remains null
    const state = useAuthStore.getState()
    expect(state.salon).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('clearError clears the error state', () => {
    useAuthStore.setState({ error: 'Some error' })

    act(() => {
      useAuthStore.getState().clearError()
    })

    expect(useAuthStore.getState().error).toBeNull()
  })

  it('sets isLoading to true during checkAuth', async () => {
    const { auth } = await import('../services/api')
    const mockMe = vi.mocked(auth.me)

    let resolvePromise: (value: any) => void
    mockMe.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        })
    )

    // Start checkAuth
    const checkAuthPromise = useAuthStore.getState().checkAuth()

    // Check loading state is true during the call
    expect(useAuthStore.getState().isLoading).toBe(true)

    // Resolve the promise
    resolvePromise!({ id: '1', email: 'test@example.com' })
    await checkAuthPromise

    // Loading should be false after completion
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
