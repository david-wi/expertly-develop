import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

const UI_REMOTE_URL = process.env.VITE_UI_REMOTE_URL || 'https://ui.ai.devintensive.com'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'expertly_salon',
      remotes: {
        expertly_ui: `${UI_REMOTE_URL}/assets/remoteEntry.js`,
      } as Record<string, unknown>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0 || ^19.0.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0 || ^19.0.0', eager: true },
      } as any,
    }),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: true,
    cssCodeSplit: false,
  },
})
