// Theme definitions for Expertly apps

export type ThemeId = 'violet' | 'ocean' | 'emerald'
export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
  // Primary color palette
  primary: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
    950: string
  }
  // Background colors
  background: {
    default: string
    surface: string
    elevated: string
  }
  // Text colors
  text: {
    primary: string
    secondary: string
    muted: string
  }
  // Border colors
  border: {
    default: string
    subtle: string
  }
  // Sidebar colors (optional - falls back to background/text if not provided)
  sidebar?: {
    background: string
    backgroundHover: string
    text: string
    textMuted: string
    border: string
    /** Strong text color for headers/product name - high contrast */
    textStrong?: string
    /** Active item text color - visible on sidebar background */
    activeText?: string
  }
}

export interface Theme {
  id: ThemeId
  name: string
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
}

export const themes: Record<ThemeId, Theme> = {
  violet: {
    id: 'violet',
    name: 'Violet',
    colors: {
      light: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        background: {
          default: '#f9fafb', // gray-50
          surface: '#ffffff',
          elevated: '#ffffff',
        },
        text: {
          primary: '#111827', // gray-900
          secondary: '#4b5563', // gray-600
          muted: '#6b7280', // gray-500
        },
        border: {
          default: '#e5e7eb', // gray-200
          subtle: '#f3f4f6', // gray-100
        },
        // Light sidebar (matches content area)
        sidebar: {
          background: '#ffffff',
          backgroundHover: '#f3f4f6', // gray-100
          text: '#4b5563', // gray-600
          textMuted: '#9ca3af', // gray-400
          border: '#e5e7eb', // gray-200
          textStrong: '#111827', // gray-900 - for product name, user name
          activeText: '#7c3aed', // violet-600 - visible on white
        },
      },
      dark: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        background: {
          default: '#111827', // gray-900
          surface: '#1f2937', // gray-800
          elevated: '#374151', // gray-700
        },
        text: {
          primary: '#f9fafb', // gray-50
          secondary: '#9ca3af', // gray-400
          muted: '#6b7280', // gray-500
        },
        border: {
          default: '#374151', // gray-700
          subtle: '#1f2937', // gray-800
        },
        sidebar: {
          background: '#1f2937', // gray-800
          backgroundHover: '#374151', // gray-700
          text: '#9ca3af', // gray-400
          textMuted: '#6b7280', // gray-500
          border: '#374151', // gray-700
          textStrong: '#f9fafb', // gray-50 - white for dark sidebar
          activeText: '#c4b5fd', // violet-300 - visible on dark
        },
      },
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      light: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        background: {
          default: '#f9fafb', // gray-50
          surface: '#ffffff',
          elevated: '#ffffff',
        },
        text: {
          primary: '#111827', // gray-900
          secondary: '#4b5563', // gray-600
          muted: '#6b7280', // gray-500
        },
        border: {
          default: '#e5e7eb', // gray-200
          subtle: '#f3f4f6', // gray-100
        },
        // Light sidebar
        sidebar: {
          background: '#ffffff',
          backgroundHover: '#f3f4f6',
          text: '#4b5563',
          textMuted: '#9ca3af',
          border: '#e5e7eb',
          textStrong: '#111827', // gray-900 - for product name
          activeText: '#0d9488', // teal-600 - visible on white
        },
      },
      dark: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        background: {
          default: '#0f172a', // slate-900
          surface: '#1e293b', // slate-800
          elevated: '#334155', // slate-700
        },
        text: {
          primary: '#f8fafc', // slate-50
          secondary: '#94a3b8', // slate-400
          muted: '#64748b', // slate-500
        },
        border: {
          default: '#334155', // slate-700
          subtle: '#1e293b', // slate-800
        },
        sidebar: {
          background: '#1e293b', // slate-800
          backgroundHover: '#334155', // slate-700
          text: '#94a3b8', // slate-400
          textMuted: '#64748b', // slate-500
          border: '#334155', // slate-700
          textStrong: '#f8fafc', // slate-50 - white for dark sidebar
          activeText: '#5eead4', // teal-300 - visible on dark
        },
      },
    },
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    colors: {
      light: {
        // Teal primary colors (matching mockup design)
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        background: {
          default: '#fafaf9', // stone-50
          surface: '#ffffff',
          elevated: '#ffffff',
        },
        text: {
          primary: '#1c1917', // stone-900
          secondary: '#57534e', // stone-600
          muted: '#78716c', // stone-500
        },
        border: {
          default: '#e7e5e4', // stone-200
          subtle: '#f5f5f4', // stone-100
        },
        // Dark sidebar even in light mode (matching mockup design)
        sidebar: {
          background: '#1c1917', // stone-900
          backgroundHover: '#292524', // stone-800
          text: '#a8a29e', // stone-400
          textMuted: '#57534e', // stone-600
          border: '#292524', // stone-800
          textStrong: '#fafaf9', // stone-50 - white for dark sidebar
          activeText: '#5eead4', // teal-300 - visible on dark
        },
      },
      dark: {
        // Teal primary colors (matching mockup design)
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        background: {
          default: '#1c1917', // stone-900
          surface: '#292524', // stone-800
          elevated: '#44403c', // stone-700
        },
        text: {
          primary: '#fafaf9', // stone-50
          secondary: '#a8a29e', // stone-400
          muted: '#78716c', // stone-500
        },
        border: {
          default: '#44403c', // stone-700
          subtle: '#292524', // stone-800
        },
        sidebar: {
          background: '#1c1917', // stone-900
          backgroundHover: '#292524', // stone-800
          text: '#a8a29e', // stone-400
          textMuted: '#57534e', // stone-600
          border: '#292524', // stone-800
          textStrong: '#fafaf9', // stone-50 - white for dark sidebar
          activeText: '#5eead4', // teal-300 - visible on dark
        },
      },
    },
  },
}

export const themeList = Object.values(themes)

export function getTheme(id: ThemeId): Theme {
  return themes[id] || themes.violet
}

export function getThemeColors(id: ThemeId, mode: ThemeMode): ThemeColors {
  const theme = getTheme(id)
  return theme.colors[mode]
}
