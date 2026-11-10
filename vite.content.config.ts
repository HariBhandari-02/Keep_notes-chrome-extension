import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome110',
    minify: false,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: `${root}src/content/content.tsx`,
      output: {
        entryFileNames: 'content.js',
        format: 'iife',
        name: 'KeepNotesContent',
      },
    },
  },
})
