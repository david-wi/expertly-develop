/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

const UI_REMOTE_URL = process.env.VITE_UI_REMOTE_URL || 'https://ui.ai.devintensive.com'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'expertly_today',
      remotes: {
        expertly_ui: `${UI_REMOTE_URL}/assets/remoteEntry.js`,
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0 || ^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0 || ^19.0.0' },
      },
    }),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: true,
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
