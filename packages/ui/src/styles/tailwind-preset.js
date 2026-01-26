// Shared Tailwind preset for all Expertly apps
// Use this preset in your tailwind.config.js:
// presets: [require('@expertly/ui/styles/tailwind-preset')]

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary color using CSS variables for theme support
        primary: {
          50: 'var(--theme-primary-50)',
          100: 'var(--theme-primary-100)',
          200: 'var(--theme-primary-200)',
          300: 'var(--theme-primary-300)',
          400: 'var(--theme-primary-400)',
          500: 'var(--theme-primary-500)',
          600: 'var(--theme-primary-600)',
          700: 'var(--theme-primary-700)',
          800: 'var(--theme-primary-800)',
          900: 'var(--theme-primary-900)',
          950: 'var(--theme-primary-950)',
        },
        // Semantic colors using CSS variables
        'theme-bg': {
          DEFAULT: 'var(--theme-bg-default)',
          surface: 'var(--theme-bg-surface)',
          elevated: 'var(--theme-bg-elevated)',
        },
        'theme-text': {
          DEFAULT: 'var(--theme-text-primary)',
          primary: 'var(--theme-text-primary)',
          secondary: 'var(--theme-text-secondary)',
          muted: 'var(--theme-text-muted)',
        },
        'theme-border': {
          DEFAULT: 'var(--theme-border-default)',
          subtle: 'var(--theme-border-subtle)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}
