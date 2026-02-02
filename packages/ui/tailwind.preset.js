/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary colors using CSS variables - set by ThemeProvider
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
        // Sidebar colors
        'theme-sidebar-bg': 'var(--theme-sidebar-bg)',
        'theme-sidebar-bg-hover': 'var(--theme-sidebar-bg-hover)',
        'theme-sidebar-text': 'var(--theme-sidebar-text)',
        'theme-sidebar-text-muted': 'var(--theme-sidebar-text-muted)',
        'theme-sidebar-border': 'var(--theme-sidebar-border)',
        'theme-sidebar-text-strong': 'var(--theme-sidebar-text-strong)',
        'theme-sidebar-active-text': 'var(--theme-sidebar-active-text)',
      },
      backgroundColor: {
        'theme-bg': 'var(--theme-bg-default)',
        'theme-bg-surface': 'var(--theme-bg-surface)',
        'theme-bg-elevated': 'var(--theme-bg-elevated)',
        'theme-sidebar-bg': 'var(--theme-sidebar-bg)',
        'theme-sidebar-bg-hover': 'var(--theme-sidebar-bg-hover)',
      },
      textColor: {
        'theme-text-primary': 'var(--theme-text-primary)',
        'theme-text-secondary': 'var(--theme-text-secondary)',
        'theme-text-muted': 'var(--theme-text-muted)',
        'theme-sidebar-text': 'var(--theme-sidebar-text)',
        'theme-sidebar-text-muted': 'var(--theme-sidebar-text-muted)',
        'theme-sidebar-text-strong': 'var(--theme-sidebar-text-strong)',
        'theme-sidebar-active-text': 'var(--theme-sidebar-active-text)',
      },
      borderColor: {
        'theme-border': 'var(--theme-border-default)',
        'theme-border-subtle': 'var(--theme-border-subtle)',
        'theme-sidebar-border': 'var(--theme-sidebar-border)',
      },
    },
  },
  plugins: [],
}
