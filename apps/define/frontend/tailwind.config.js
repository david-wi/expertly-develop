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
  plugins: [],
}
