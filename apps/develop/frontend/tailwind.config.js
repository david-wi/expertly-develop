/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette using CSS variables for theme support
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
        // Theme colors using CSS variables
        'theme-bg': 'var(--theme-bg-default)',
        'theme-bg-surface': 'var(--theme-bg-surface)',
        'theme-bg-elevated': 'var(--theme-bg-elevated)',
        'theme-text-primary': 'var(--theme-text-primary)',
        'theme-text-secondary': 'var(--theme-text-secondary)',
        'theme-text-muted': 'var(--theme-text-muted)',
        'theme-border': 'var(--theme-border-default)',
        'theme-border-subtle': 'var(--theme-border-subtle)',
      },
      backgroundColor: {
        'theme-bg': 'var(--theme-bg-default)',
        'theme-bg-surface': 'var(--theme-bg-surface)',
        'theme-bg-elevated': 'var(--theme-bg-elevated)',
      },
      textColor: {
        'theme-text': 'var(--theme-text-primary)',
        'theme-text-primary': 'var(--theme-text-primary)',
        'theme-text-secondary': 'var(--theme-text-secondary)',
        'theme-text-muted': 'var(--theme-text-muted)',
      },
      borderColor: {
        'theme-border': 'var(--theme-border-default)',
        'theme-border-subtle': 'var(--theme-border-subtle)',
      },
    },
  },
  plugins: [],
}
