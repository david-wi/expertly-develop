import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'expertly_ui',
      filename: 'remoteEntry.js',
      exposes: {
        // Main exports
        './Sidebar': './src/components/Sidebar.tsx',
        './theme': './src/theme/index.ts',
        './ThemeProvider': './src/theme/ThemeProvider.tsx',
        './ThemeSwitcher': './src/theme/ThemeSwitcher.tsx',
        './useTheme': './src/theme/useTheme.ts',
        './themes': './src/theme/themes.ts',
        './buildInfo': './src/utils/buildInfo.ts',
        // Full index for convenience
        './index': './src/index.ts',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.0.0 || ^19.0.0',
          import: false, // Remote should use host's React, not bundle its own
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0 || ^19.0.0',
          import: false, // Remote should use host's React-DOM, not bundle its own
        },
      },
    }),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
  server: {
    port: 5001,
    cors: true,
  },
  preview: {
    port: 5001,
    cors: true,
  },
})
