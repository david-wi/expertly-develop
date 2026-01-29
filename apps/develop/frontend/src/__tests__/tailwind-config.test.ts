import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
// @ts-expect-error - tailwind.config.js has no type declarations
import config from '../../tailwind.config.js'

describe('tailwind.config.js', () => {
  it('content paths should exist', () => {
    for (const pattern of config.content) {
      // Extract the directory part (before any glob wildcards)
      const dirPart = pattern.split('*')[0].replace(/\/+$/, '')
      if (!dirPart) continue // Skip if pattern starts with *

      const resolved = path.resolve(__dirname, '../..', dirPart)

      expect(
        fs.existsSync(resolved),
        `Tailwind content path does not exist: ${pattern} (resolved to ${resolved})`
      ).toBe(true)
    }
  })
})
