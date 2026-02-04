import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { target: 'esnext', minify: true },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } } },
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || 'dev'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
