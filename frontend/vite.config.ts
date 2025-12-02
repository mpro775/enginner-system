import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Silently handle WebSocket proxy errors during development
            // These are common when the backend restarts
            const errorCodes = ['ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED'];
            if (errorCodes.includes(err.code)) {
              // Suppress these expected errors during hot reload
              return;
            }
            console.error('Proxy error:', err);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.on('error', (err) => {
              // Handle socket errors gracefully
              if (err.code !== 'ECONNABORTED' && err.code !== 'ECONNRESET') {
                console.error('WebSocket proxy error:', err);
              }
            });
          });
        },
      },
    },
  },
});



