import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'esnext', minify: false },
  server: { port: 5001, cors: true },
})
