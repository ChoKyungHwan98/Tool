import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/tools/deck/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../src/shared', import.meta.url)),
      '@deck-main': fileURLToPath(new URL('../src/main/io/deck-ir-export', import.meta.url)),
      fs: fileURLToPath(new URL('./src/shims/fs.ts', import.meta.url)),
      path: fileURLToPath(new URL('./src/shims/path.ts', import.meta.url)),
      module: fileURLToPath(new URL('./src/shims/module.ts', import.meta.url)),
      url: fileURLToPath(new URL('./src/shims/url.ts', import.meta.url))
    }
  },
  build: {
    outDir: `${projectRoot}/dist-studio`,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          office: ['@arcsin1/html2pptx', 'fflate']
        }
      }
    }
  }
})
