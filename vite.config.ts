import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// squad M1: pinar host em 127.0.0.1 — NÃO usar --host na Fase 1 (anula o bind
// do backend e expõe RCE com firewall off). strictPort evita fallback silencioso.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:7777', ws: true },
    },
  },
});
