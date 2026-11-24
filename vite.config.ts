import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    cssMinify: true,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
