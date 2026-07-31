import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]@tiptap[\\/]|[\\/]prosemirror-/.test(id)) return 'vendor-tiptap'
          if (/[\\/]react[\\/]|[\\/]react-dom[\\/]|[\\/]react-router/.test(id)) return 'vendor-react'
          if (/[\\/]@radix-ui[\\/]/.test(id)) return 'vendor-radix'
          if (/[\\/]@dnd-kit[\\/]/.test(id)) return 'vendor-dnd'
          if (/[\\/]dexie[\\/]/.test(id)) return 'vendor-dexie'
          return 'vendor'
        },
      },
    },
  },
})
