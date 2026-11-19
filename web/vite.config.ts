import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The EDAgent API base URL is injected at build time via VITE_EDAGENT_API_URL.
// In development, /api is proxied to the local FastAPI server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: { plotly: ['plotly.js-cartesian-dist-min', 'react-plotly.js'], pdfjs: ['pdfjs-dist'] },
      },
    },
  },
});
