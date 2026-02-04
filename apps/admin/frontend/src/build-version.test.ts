import { describe, it, expect } from 'vitest'

describe('Build Version', () => {
  it('should have __BUILD_VERSION__ defined', () => {
    // In test environment, this will be 'dev' (default value)
    expect(typeof __BUILD_VERSION__).toBe('string')
    expect(__BUILD_VERSION__.length).toBeGreaterThan(0)
  })

  it('should have __BUILD_TIME__ defined', () => {
    expect(typeof __BUILD_TIME__).toBe('string')
    // Should be a valid ISO date string
    expect(() => new Date(__BUILD_TIME__)).not.toThrow()
  })
})
