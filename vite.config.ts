import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills(),
    tailwindcss(),
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`
        entry: 'electron-src/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'electron',
                'electron/main',
                'hyperswarm', 
                'b4a',
                'path',
                'crypto',
                'fs',
                'buffer',
                'util',
                'events',
                'process'
              ]
            }
          }
        }
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`
        input: 'electron-src/preload.ts',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})