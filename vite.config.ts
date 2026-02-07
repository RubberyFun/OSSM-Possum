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
    rollupOptions: {
      input: {
        main: './main.html',
      },
    },
    emptyOutDir: false, // This line prevents clearing the output directory
    outDir: './dist', // Output to dist directory
  },
  plugins: [
    svelte(), 
    basicSsl(),  // Enable HTTPS for development
    viteSingleFile(),
    {
      name: 'rewrite-root',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            req.url = '/main.html';
          }
          next();
        });
      }
    },
    {
      name: 'rename-index',
      closeBundle: async () => {
        const fs = await import('fs');
        const path = await import('path');
        const mainPath = path.resolve('./dist/main.html');
        const indexPath = path.resolve('./dist/index.html');
        if (fs.existsSync(mainPath)) {
          fs.renameSync(mainPath, indexPath);
        }
      }
    }
  ],
  server: {
    open: '/',
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

