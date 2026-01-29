/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Local dev: shared UI package
    "../../../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    // Docker build: UI package copied to packages-ui-src (at build root)
    "../../../packages-ui-src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      colors: {
        panel: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        brand: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdc9',
          300: '#fca9a3',
          400: '#f87a6f',
          500: '#ee5144',
          600: '#db3426',
          700: '#b8291c',
          800: '#98251b',
          900: '#7e251d',
          950: '#440f0a',
        },
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
        'theme-text-primary': 'var(--theme-text-primary)',
        'theme-text-secondary': 'var(--theme-text-secondary)',
        'theme-text-muted': 'var(--theme-text-muted)',
      },
      borderColor: {
        'theme-border': 'var(--theme-border-default)',
        'theme-border-subtle': 'var(--theme-border-subtle)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
