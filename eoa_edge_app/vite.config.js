import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Sovereign Tactical Edge Mobile Terminal (C4ISR Phase 2)
// Strictly bound to whitelisted port 5173
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
