/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  worker: { format: 'es' },
  build: { rollupOptions: { input: { main: 'index.html', reader: 'reader.html' } } },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    // Node 22 lacks Promise.try, which the modern pdf.js build needs; browsers get the modern build.
    alias: { 'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs' },
  },
})
