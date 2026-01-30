import { describe, it, expect } from 'vitest'
import { EXPERTLY_PRODUCTS } from './Sidebar'

describe('EXPERTLY_PRODUCTS', () => {
  it('should have at least one product', () => {
    expect(EXPERTLY_PRODUCTS.length).toBeGreaterThan(0)
  })

  it('should have unique product codes', () => {
    const codes = EXPERTLY_PRODUCTS.map(p => p.code)
    const uniqueCodes = new Set(codes)
    expect(codes.length).toBe(uniqueCodes.size)
  })

  it('should have unique product names', () => {
    const names = EXPERTLY_PRODUCTS.map(p => p.name)
    const uniqueNames = new Set(names)
    expect(names.length).toBe(uniqueNames.size)
  })

  it('should have valid URLs pointing to ai.devintensive.com', () => {
    EXPERTLY_PRODUCTS.forEach(product => {
      expect(product.href).toMatch(/^https:\/\/[a-z-]+\.ai\.devintensive\.com$/)
    })
  })

  it('should have URLs matching their product codes', () => {
    EXPERTLY_PRODUCTS.forEach(product => {
      const expectedUrl = `https://${product.code}.ai.devintensive.com`
      expect(product.href).toBe(expectedUrl)
    })
  })

  it('should have product names that fit in the sidebar', () => {
    // Sidebar header shows "Expertly {productName}" (from props), dropdown shows full product.name
    // With w-72 (288px), full names like "Expertly VibeCode" (17 chars) fit comfortably
    const MAX_PRODUCT_NAME_LENGTH = 20
    EXPERTLY_PRODUCTS.forEach(product => {
      expect(product.name.length).toBeLessThanOrEqual(MAX_PRODUCT_NAME_LENGTH)
      // All product names should start with "Expertly "
      expect(product.name).toMatch(/^Expertly /)
    })
  })

  it('should have descriptions', () => {
    EXPERTLY_PRODUCTS.forEach(product => {
      expect(product.description).toBeTruthy()
      expect(product.description.length).toBeGreaterThan(0)
    })
  })

  it('should have emoji icons', () => {
    EXPERTLY_PRODUCTS.forEach(product => {
      expect(product.icon).toBeTruthy()
      // Basic check that it's a single emoji (may include variation selectors)
      expect(product.icon.length).toBeLessThanOrEqual(4)
    })
  })

  // List of deployed products - update this when adding/removing apps
  const DEPLOYED_PRODUCTS = [
    'define',
    'develop',
    'identity',
    'manage',
    'salon',
    'today',
    'vibecode',
    'vibetest',
  ]

  it('should only include deployed products', () => {
    const productCodes = EXPERTLY_PRODUCTS.map(p => p.code)
    productCodes.forEach(code => {
      expect(DEPLOYED_PRODUCTS).toContain(code)
    })
  })

  it('should include all deployed products', () => {
    const productCodes = EXPERTLY_PRODUCTS.map(p => p.code)
    DEPLOYED_PRODUCTS.forEach(code => {
      expect(productCodes).toContain(code)
    })
  })
})
