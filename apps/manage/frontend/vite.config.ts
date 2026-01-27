import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

const UI_REMOTE_URL = process.env.VITE_UI_REMOTE_URL || 'https://ui.ai.devintensive.com'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'expertly_manage',
      remotes: {
        expertly_ui: `${UI_REMOTE_URL}/assets/remoteEntry.js`,
      } as const as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: true },
      } as any,
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
      } as const as any,
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      } as const as any,
    },
  },
})
