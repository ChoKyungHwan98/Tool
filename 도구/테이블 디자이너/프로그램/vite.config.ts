import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react'
          }

          if (id.includes('node_modules/@xyflow')) {
            return 'flow'
          }

          if (id.includes('node_modules/@tanstack/react-table')) {
            return 'table'
          }

          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }

          if (id.includes('node_modules/@tauri-apps')) {
            return 'tauri'
          }

          return undefined
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: true,
  },
})
