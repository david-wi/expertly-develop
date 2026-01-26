/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Violet primary palette for unified Expertly branding
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
