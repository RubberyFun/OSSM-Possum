import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import basicSsl from '@vitejs/plugin-basic-ssl' // Enable HTTPS for development
import { viteSingleFile } from "vite-plugin-singlefile"
import { Buffer } from 'buffer'
//import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    'global': 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      'events': 'events',
      'buffer': 'buffer'
    }
  },
  optimizeDeps: {
    include: ['buttplug', 'buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    emptyOutDir: false, // This line prevents clearing the output directory
    outDir: './public', // Output to public directory
  },
  plugins: [
    svelte(), 
    basicSsl(),  // Enable HTTPS for development
    viteSingleFile(),
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
})

