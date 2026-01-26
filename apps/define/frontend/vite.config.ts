import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

// UI remote URL - use environment variable in production, local in dev
const UI_REMOTE_URL = process.env.VITE_UI_REMOTE_URL || 'https://ui.ai.devintensive.com'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'expertly_define',
      remotes: {
        expertly_ui: `${UI_REMOTE_URL}/remoteEntry.js`,
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
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
