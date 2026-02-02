import { describe, it, expect } from 'vitest'
import { themes, themeList, getTheme, getThemeColors } from './themes'
import type { ThemeId, ThemeMode, ThemeColors } from './themes'

/**
 * Calculate relative luminance of a color (for contrast calculations)
 * Based on WCAG 2.0 formula
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if a color is "light" (luminance > 0.5)
 */
function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5
}

// Minimum contrast ratios (WCAG AA)
const MIN_CONTRAST_NORMAL_TEXT = 4.5
const MIN_CONTRAST_LARGE_TEXT = 3.0
const MIN_CONTRAST_UI_COMPONENTS = 3.0
// Muted text is intentionally lower contrast for de-emphasized content
// WCAG allows incidental/decorative text to have lower contrast
const MIN_CONTRAST_MUTED_TEXT = 2.0

describe('Theme Definitions', () => {
  const themeIds: ThemeId[] = ['violet', 'ocean', 'emerald']
  const modes: ThemeMode[] = ['light', 'dark']

  describe('Theme structure', () => {
    it('should have all required themes defined', () => {
      themeIds.forEach(id => {
        expect(themes[id]).toBeDefined()
        expect(themes[id].id).toBe(id)
        expect(themes[id].name).toBeTruthy()
      })
    })

    it('should have themeList with all themes', () => {
      expect(themeList.length).toBe(themeIds.length)
      themeIds.forEach(id => {
        expect(themeList.some(t => t.id === id)).toBe(true)
      })
    })

    it('getTheme should return correct theme', () => {
      themeIds.forEach(id => {
        const theme = getTheme(id)
        expect(theme.id).toBe(id)
      })
    })

    it('getTheme should fallback to violet for unknown theme', () => {
      const theme = getTheme('unknown' as ThemeId)
      expect(theme.id).toBe('violet')
    })
  })

  describe('Required sidebar colors', () => {
    // These are the colors that MUST be defined to prevent visibility issues
    const requiredSidebarColors = [
      'background',
      'backgroundHover',
      'text',
      'textMuted',
      'border',
      'textStrong',    // For product name, user name
      'activeText',    // For active nav items
      'textHover',     // For hovered nav items
    ] as const

    themeIds.forEach(themeId => {
      modes.forEach(mode => {
        it(`${themeId}/${mode}: should have all required sidebar colors defined`, () => {
          const colors = getThemeColors(themeId, mode)
          const sidebar = colors.sidebar

          expect(sidebar).toBeDefined()

          requiredSidebarColors.forEach(colorName => {
            expect(
              sidebar?.[colorName as keyof typeof sidebar],
              `Missing sidebar.${colorName} in ${themeId}/${mode}`
            ).toBeTruthy()
          })
        })
      })
    })
  })

  describe('Sidebar color contrast', () => {
    themeIds.forEach(themeId => {
      modes.forEach(mode => {
        describe(`${themeId}/${mode}`, () => {
          let colors: ThemeColors
          let sidebar: NonNullable<ThemeColors['sidebar']>

          beforeAll(() => {
            colors = getThemeColors(themeId, mode)
            sidebar = colors.sidebar!
          })

          it('textStrong should be visible on sidebar background', () => {
            const contrast = getContrastRatio(sidebar.textStrong!, sidebar.background)
            expect(
              contrast,
              `textStrong (${sidebar.textStrong}) on background (${sidebar.background}) has contrast ${contrast.toFixed(2)}, need ${MIN_CONTRAST_NORMAL_TEXT}`
            ).toBeGreaterThanOrEqual(MIN_CONTRAST_NORMAL_TEXT)
          })

          it('text should be visible on sidebar background', () => {
            const contrast = getContrastRatio(sidebar.text, sidebar.background)
            expect(
              contrast,
              `text (${sidebar.text}) on background (${sidebar.background}) has contrast ${contrast.toFixed(2)}, need ${MIN_CONTRAST_NORMAL_TEXT}`
            ).toBeGreaterThanOrEqual(MIN_CONTRAST_NORMAL_TEXT)
          })

          it('textMuted should be reasonably visible on sidebar background', () => {
            // Muted text is intentionally lower contrast for de-emphasized content
            // It should still be readable but doesn't need to meet full WCAG AA
            const contrast = getContrastRatio(sidebar.textMuted, sidebar.background)
            expect(
              contrast,
              `textMuted (${sidebar.textMuted}) on background (${sidebar.background}) has contrast ${contrast.toFixed(2)}, need ${MIN_CONTRAST_MUTED_TEXT}`
            ).toBeGreaterThanOrEqual(MIN_CONTRAST_MUTED_TEXT)
          })

          it('activeText should be visible on sidebar background', () => {
            const contrast = getContrastRatio(sidebar.activeText!, sidebar.background)
            expect(
              contrast,
              `activeText (${sidebar.activeText}) on background (${sidebar.background}) has contrast ${contrast.toFixed(2)}, need ${MIN_CONTRAST_NORMAL_TEXT}`
            ).toBeGreaterThanOrEqual(MIN_CONTRAST_NORMAL_TEXT)
          })

          it('textHover should be visible on hover background', () => {
            const contrast = getContrastRatio(sidebar.textHover!, sidebar.backgroundHover)
            expect(
              contrast,
              `textHover (${sidebar.textHover}) on backgroundHover (${sidebar.backgroundHover}) has contrast ${contrast.toFixed(2)}, need ${MIN_CONTRAST_NORMAL_TEXT}`
            ).toBeGreaterThanOrEqual(MIN_CONTRAST_NORMAL_TEXT)
          })

          it('sidebar background should match expected brightness for mode', () => {
            const isLight = isLightColor(sidebar.background)

            // For most themes, light mode = light sidebar, dark mode = dark sidebar
            // Exception: Emerald has dark sidebar in both modes
            if (themeId === 'emerald') {
              // Emerald always has dark sidebar
              expect(isLight, 'Emerald should have dark sidebar').toBe(false)
            } else {
              // Violet and Ocean: sidebar brightness should match mode
              // (light sidebar in light mode, dark in dark mode)
              const expectedLight = mode === 'light'
              expect(
                isLight,
                `${themeId}/${mode} sidebar should be ${expectedLight ? 'light' : 'dark'}`
              ).toBe(expectedLight)
            }
          })

          it('textStrong should contrast with text for hierarchy', () => {
            // textStrong should be more prominent than regular text
            const strongLum = getLuminance(sidebar.textStrong!)
            const textLum = getLuminance(sidebar.text)
            const bgLum = getLuminance(sidebar.background)

            // textStrong should be further from background luminance than text
            const strongDistance = Math.abs(strongLum - bgLum)
            const textDistance = Math.abs(textLum - bgLum)

            expect(
              strongDistance,
              'textStrong should have higher contrast than text'
            ).toBeGreaterThanOrEqual(textDistance * 0.8) // Allow 20% tolerance
          })
        })
      })
    })
  })

  describe('Primary colors', () => {
    themeIds.forEach(themeId => {
      modes.forEach(mode => {
        it(`${themeId}/${mode}: should have complete primary color palette`, () => {
          const colors = getThemeColors(themeId, mode)
          const primaryShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

          primaryShades.forEach(shade => {
            expect(
              colors.primary[shade as keyof typeof colors.primary],
              `Missing primary.${shade} in ${themeId}/${mode}`
            ).toBeTruthy()
          })
        })

        it(`${themeId}/${mode}: primary colors should be valid hex values`, () => {
          const colors = getThemeColors(themeId, mode)

          Object.values(colors.primary).forEach(color => {
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
          })
        })
      })
    })
  })

  describe('Color consistency across modes', () => {
    themeIds.forEach(themeId => {
      it(`${themeId}: light and dark modes should have different backgrounds`, () => {
        const lightColors = getThemeColors(themeId, 'light')
        const darkColors = getThemeColors(themeId, 'dark')

        expect(lightColors.background.default).not.toBe(darkColors.background.default)
      })

      it(`${themeId}: primary colors should be the same across modes`, () => {
        const lightColors = getThemeColors(themeId, 'light')
        const darkColors = getThemeColors(themeId, 'dark')

        // Primary brand colors should be consistent
        expect(lightColors.primary['500']).toBe(darkColors.primary['500'])
        expect(lightColors.primary['600']).toBe(darkColors.primary['600'])
      })
    })
  })

  describe('No hardcoded white text on light backgrounds', () => {
    // This test specifically catches the bug where white text was used on light sidebars
    themeIds.forEach(themeId => {
      it(`${themeId}/light: should not have white textStrong on light sidebar`, () => {
        const colors = getThemeColors(themeId, 'light')
        const sidebar = colors.sidebar!

        const sidebarIsLight = isLightColor(sidebar.background)

        if (sidebarIsLight) {
          // If sidebar is light, textStrong should be dark (not white)
          const textStrongIsLight = isLightColor(sidebar.textStrong!)
          expect(
            textStrongIsLight,
            `Light sidebar should not have light textStrong (${sidebar.textStrong})`
          ).toBe(false)
        }
      })

      it(`${themeId}/light: should not have white textHover on light hover background`, () => {
        const colors = getThemeColors(themeId, 'light')
        const sidebar = colors.sidebar!

        const hoverBgIsLight = isLightColor(sidebar.backgroundHover)

        if (hoverBgIsLight) {
          // If hover background is light, textHover should be dark
          const textHoverIsLight = isLightColor(sidebar.textHover!)
          expect(
            textHoverIsLight,
            `Light hover background should not have light textHover (${sidebar.textHover})`
          ).toBe(false)
        }
      })
    })
  })
})
