import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from './appStore'
import api from '../services/api'

// Mock the api module
vi.mock('../services/api', () => ({
  default: {
    setApiKey: vi.fn(),
  },
}))

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      apiKey: null,
      isAuthenticated: false,
      sidebarOpen: true,
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts with null apiKey', () => {
      const state = useAppStore.getState()
      expect(state.apiKey).toBeNull()
    })

    it('starts as not authenticated', () => {
      const state = useAppStore.getState()
      expect(state.isAuthenticated).toBe(false)
    })

    it('starts with sidebar open', () => {
      const state = useAppStore.getState()
      expect(state.sidebarOpen).toBe(true)
    })
  })

  describe('setApiKey', () => {
    it('sets the API key', () => {
      useAppStore.getState().setApiKey('test-key-123')

      const state = useAppStore.getState()
      expect(state.apiKey).toBe('test-key-123')
    })

    it('sets isAuthenticated to true', () => {
      useAppStore.getState().setApiKey('test-key-123')

      const state = useAppStore.getState()
      expect(state.isAuthenticated).toBe(true)
    })

    it('calls api.setApiKey', () => {
      useAppStore.getState().setApiKey('test-key-123')

      expect(api.setApiKey).toHaveBeenCalledWith('test-key-123')
    })
  })

  describe('logout', () => {
    beforeEach(() => {
      // First authenticate
      useAppStore.getState().setApiKey('test-key-123')
    })

    it('clears the API key', () => {
      useAppStore.getState().logout()

      const state = useAppStore.getState()
      expect(state.apiKey).toBeNull()
    })

    it('sets isAuthenticated to false', () => {
      useAppStore.getState().logout()

      const state = useAppStore.getState()
      expect(state.isAuthenticated).toBe(false)
    })

    it('removes api_key from localStorage', () => {
      useAppStore.getState().logout()

      expect(localStorage.removeItem).toHaveBeenCalledWith('api_key')
    })
  })

  describe('toggleSidebar', () => {
    it('toggles sidebar from open to closed', () => {
      expect(useAppStore.getState().sidebarOpen).toBe(true)

      useAppStore.getState().toggleSidebar()

      expect(useAppStore.getState().sidebarOpen).toBe(false)
    })

    it('toggles sidebar from closed to open', () => {
      useAppStore.getState().setSidebarOpen(false)

      useAppStore.getState().toggleSidebar()

      expect(useAppStore.getState().sidebarOpen).toBe(true)
    })
  })

  describe('setSidebarOpen', () => {
    it('sets sidebar to open', () => {
      useAppStore.getState().setSidebarOpen(false)
      useAppStore.getState().setSidebarOpen(true)

      expect(useAppStore.getState().sidebarOpen).toBe(true)
    })

    it('sets sidebar to closed', () => {
      useAppStore.getState().setSidebarOpen(false)

      expect(useAppStore.getState().sidebarOpen).toBe(false)
    })
  })
})
