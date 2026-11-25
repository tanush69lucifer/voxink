import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        studio: resolve(root, 'index.html'),
        stage: resolve(root, 'stage.html'),
        console: resolve(root, 'console.html'),
        remote: resolve(root, 'remote.html'),
      },
    },
  },
});
