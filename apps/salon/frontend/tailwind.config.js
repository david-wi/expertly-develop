/** @type {import('tailwindcss').Config} */
import uiPreset from '@expertly/ui/tailwind.preset'

export default {
  presets: [uiPreset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "./packages-ui-src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#FDFCFA', 100: '#F9F5ED', 200: '#F0E6D3', 300: '#E5D4B3',
          400: '#D4BD8C', 500: '#C9A86C', 600: '#B08E4F', 700: '#8A6E3E',
          800: '#675231', 900: '#453724',
        },
        warm: {
          50: '#FAF7F5', 100: '#F5F0EB', 200: '#EDE5DD', 300: '#DDD0C4',
          400: '#C5B5A5', 500: '#A89888', 600: '#8A7A6A', 700: '#6B5D4F',
          800: '#4A4039', 900: '#2D2622',
        },
        success: {
          50: '#F4F9F4', 100: '#E8F2E8', 200: '#D0E5D0', 300: '#A8C5A8',
          400: '#7AA87A', 500: '#5A8A5A', 600: '#476B47', 700: '#375237',
          800: '#2A3D2A', 900: '#1D2A1D',
        },
        warning: {
          50: '#FFFBF5', 100: '#FEF3E6', 200: '#FCE5C7', 300: '#F5D0A0',
          400: '#E5B87A', 500: '#D4A05A', 600: '#B88545', 700: '#946835',
          800: '#704F28', 900: '#4D361C',
        },
        error: {
          50: '#FDF7F7', 100: '#FAECEC', 200: '#F5D5D5', 300: '#E8B3B3',
          400: '#D98A8A', 500: '#C66666', 600: '#A84A4A', 700: '#853838',
          800: '#632A2A', 900: '#421D1D',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { DEFAULT: '8px', lg: '12px' },
      boxShadow: {
        'warm': '0 2px 8px rgba(74, 64, 57, 0.08)',
        'warm-lg': '0 4px 16px rgba(74, 64, 57, 0.12)',
      },
    },
  },
  plugins: [],
}
