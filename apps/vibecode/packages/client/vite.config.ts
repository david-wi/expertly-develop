import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

const UI_REMOTE_URL = process.env.VITE_UI_REMOTE_URL || 'https://ui.ai.devintensive.com';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'expertly_vibecode',
      remotes: {
        expertly_ui: `${UI_REMOTE_URL}/remoteEntry.js`,
      } as Record<string, unknown>,
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0 || ^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0 || ^19.0.0' },
      } as Record<string, unknown>,
    }),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: true,
    cssCodeSplit: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      } as Record<string, unknown>,
    },
  },
});
