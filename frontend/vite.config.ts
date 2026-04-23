import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': 'http://backend:8080',
      '/ws': { target: 'ws://backend:8080', ws: true },
      '/media': 'http://backend:8080',
      '/display': 'http://backend:8080',
    }
  }
})
