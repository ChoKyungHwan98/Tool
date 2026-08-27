import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@arcsin1/html2pptx/animation': fileURLToPath(
        new URL('./node_modules/@arcsin1/html2pptx/dist/animation-writer.js', import.meta.url)
      ),
      '@arcsin1/html2pptx/ooxml': fileURLToPath(
        new URL('./node_modules/@arcsin1/html2pptx/dist/ooxml-writer.js', import.meta.url)
      ),
      '@arcsin1/html2pptx/node': fileURLToPath(
        new URL('./node_modules/@arcsin1/html2pptx/dist/node.js', import.meta.url)
      ),
      '@arcsin1/html2pptx': fileURLToPath(
        new URL('./node_modules/@arcsin1/html2pptx/dist/index.js', import.meta.url)
      ),
      '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    environmentMatchGlobs: [['tests/unit/runtime/**', 'happy-dom']]
  }
})
