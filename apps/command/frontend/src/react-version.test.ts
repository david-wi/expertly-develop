import { describe, it, expect } from 'vitest'
import { version } from 'react'

describe('React Version', () => {
  it('should be React 19.x', () => {
    expect(version).toMatch(/^19\./)
  })
})
