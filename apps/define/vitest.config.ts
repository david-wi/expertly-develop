import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
    deps: {
      optimizer: {
        web: {
          include: ['@testing-library/react'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      'expertly_ui/index': path.resolve(__dirname, './tests/mocks/expertly-ui.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
