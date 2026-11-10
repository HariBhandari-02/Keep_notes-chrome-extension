import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome110',
    minify: false,
    modulePreload: false,
    rollupOptions: {
      input: `${root}src/background/service-worker.ts`,
      output: {
        entryFileNames: 'background.js',
        format: 'es',
      },
    },
  },
})
