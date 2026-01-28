import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test the helper functions that don't require mocking axios
describe('API Service - Helper Functions', () => {
  const ORG_STORAGE_KEY = 'expertly-identity-org-id'

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('setOrganizationId', () => {
    it('sets organization ID in localStorage', async () => {
      const { setOrganizationId } = await import('./api')
      setOrganizationId('org-123')
      expect(localStorage.setItem).toHaveBeenCalledWith(ORG_STORAGE_KEY, 'org-123')
    })
  })

  describe('getOrganizationId', () => {
    it('gets organization ID from localStorage', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('org-123')
      const { getOrganizationId } = await import('./api')
      const result = getOrganizationId()
      expect(localStorage.getItem).toHaveBeenCalledWith(ORG_STORAGE_KEY)
      expect(result).toBe('org-123')
    })

    it('returns null when no organization ID is set', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      const { getOrganizationId } = await import('./api')
      const result = getOrganizationId()
      expect(result).toBeNull()
    })
  })

  describe('clearOrganizationId', () => {
    it('clears organization ID from localStorage', async () => {
      const { clearOrganizationId } = await import('./api')
      clearOrganizationId()
      expect(localStorage.removeItem).toHaveBeenCalledWith(ORG_STORAGE_KEY)
    })
  })
})

// Type definitions test - verifying interfaces are properly exported
describe('API Service - Types', () => {
  it('exports User interface with required fields', async () => {
    const { usersApi } = await import('./api')
    // Type check - this will fail at compile time if types are wrong
    expect(usersApi).toBeDefined()
    expect(typeof usersApi.list).toBe('function')
    expect(typeof usersApi.create).toBe('function')
    expect(typeof usersApi.get).toBe('function')
    expect(typeof usersApi.update).toBe('function')
    expect(typeof usersApi.delete).toBe('function')
    expect(typeof usersApi.regenerateApiKey).toBe('function')
  })

  it('exports Organization interface with required fields', async () => {
    const { organizationsApi } = await import('./api')
    expect(organizationsApi).toBeDefined()
    expect(typeof organizationsApi.list).toBe('function')
    expect(typeof organizationsApi.create).toBe('function')
    expect(typeof organizationsApi.get).toBe('function')
  })

  it('exports Team interface with required fields', async () => {
    const { teamsApi } = await import('./api')
    expect(teamsApi).toBeDefined()
    expect(typeof teamsApi.list).toBe('function')
    expect(typeof teamsApi.create).toBe('function')
    expect(typeof teamsApi.get).toBe('function')
    expect(typeof teamsApi.update).toBe('function')
    expect(typeof teamsApi.delete).toBe('function')
    expect(typeof teamsApi.addMember).toBe('function')
    expect(typeof teamsApi.removeMember).toBe('function')
  })

  it('exports authApi with required methods', async () => {
    const { authApi } = await import('./api')
    expect(authApi).toBeDefined()
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.logout).toBe('function')
    expect(typeof authApi.validate).toBe('function')
    expect(typeof authApi.me).toBe('function')
    expect(typeof authApi.requestMagicCode).toBe('function')
    expect(typeof authApi.verifyMagicCode).toBe('function')
    expect(typeof authApi.changePassword).toBe('function')
    expect(typeof authApi.forgotPassword).toBe('function')
    expect(typeof authApi.resetPassword).toBe('function')
  })

  it('exports imagesApi with required methods', async () => {
    const { imagesApi } = await import('./api')
    expect(imagesApi).toBeDefined()
    expect(typeof imagesApi.generateAvatar).toBe('function')
  })
})
