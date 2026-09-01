/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// squad M1: pinar host em 127.0.0.1 — NÃO usar --host na Fase 1 (anula o bind
// do backend e expõe RCE com firewall off). strictPort evita fallback silencioso.
export default defineConfig({
  plugins: [react()],
  test: {
    // HOME descartável, sem credencial e sem rede externa — ver vitest.setup.ts.
    setupFiles: ['./vitest.setup.ts'],
    // VPS de 3 cores/3.7G roda tudo (Deck, terminais, prod DFL): o paralelismo
    // default da suite saturou a box no freeze de 2026-06-11 (load 130). Um
    // worker a menos que o total de cores deixa a box sempre respirando.
    maxWorkers: 2,
    minWorkers: 1,
    // Worktree de agente é uma cópia do repo em commit antigo: a suite dele
    // roda junto e falha por código que a main já corrigiu.
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
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
        // (que muda a cada deploy) deixa de invalidar o cache do vendor.
        //
        // manualChunks separa o ARQUIVO, não o CARREGAMENTO: se algo no grafo
        // estático do entry importa a lib, o Vite emite `modulepreload` e o
        // browser baixa o chunk em toda visita do mesmo jeito. Quem tira do
        // caminho crítico é o import dinâmico — por isso o xterm só sai de fato
        // do preload por causa do `lazy()` em Terminals.tsx.
        manualChunks: {
          react: ['react', 'react-dom'],
          xterm: ['@xterm/xterm', '@xterm/addon-fit'],
          sucrase: ['sucrase'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
