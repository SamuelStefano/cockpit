/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// squad M1: pinar host em 127.0.0.1 — NÃO usar --host na Fase 1 (anula o bind
// do backend e expõe RCE com firewall off). strictPort evita fallback silencioso.
export default defineConfig({
  plugins: [react()],
  test: {
    // VPS de 3 cores/3.7G roda tudo (Deck, terminais, prod DFL): o paralelismo
    // default da suite saturou a box no freeze de 2026-06-11 (load 130). Um
    // worker a menos que o total de cores deixa a box sempre respirando.
    maxWorkers: 2,
    minWorkers: 1,
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:7777', ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa libs pesadas e estáveis em chunks próprios: o bundle do app
        // (que muda a cada deploy) deixa de invalidar o cache do vendor, e some
        // o aviso de chunk > 500KB. xterm só importa no painel de terminal.
        manualChunks: {
          react: ['react', 'react-dom'],
          xterm: ['@xterm/xterm', '@xterm/addon-fit'],
        },
      },
    },
  },
});
