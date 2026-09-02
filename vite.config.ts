/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { vendorChunk } from './vendor-chunks.ts';

const BG = '#101013'; // --bg de src/index.css: a splash do iOS tem que casar com o app

// squad M1: pinar host em 127.0.0.1 — NÃO usar --host na Fase 1 (anula o bind
// do backend e expõe RCE com firewall off). strictPort evita fallback silencioso.
export default defineConfig({
  plugins: [
    react(),
    // O SW existe SÓ pra tornar o Deck instalável (na home screen o iOS libera a
    // Notification API, que no Safari em aba não existe). Nada de precache: o Deck
    // é ao vivo (WebSocket + estado do servidor) e um bundle servido do cache viraria
    // uma classe nova de bug — "o Deck não atualiza" — pior que a barra do Safari.
    // Daí globPatterns vazio, runtimeCaching vazio e navigateFallback null: sem
    // fallback o SW não sequestra navegação, e /c/<id> continua indo pro servidor.
    // Sobram no precache só o manifest e os ícones (imutáveis, e é o que dá ao SW
    // o fetch handler que o Chrome exige pra oferecer a instalação).
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: [],
        navigateFallback: null,
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Deck',
        short_name: 'deck',
        description: 'Cockpit pessoal de agentes',
        lang: 'pt-BR',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: BG,
        theme_color: BG,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    // HOME descartável, sem credencial e sem rede externa — ver vitest.setup.ts.
    setupFiles: ['./vitest.setup.ts'],
    // VPS de 3 cores/3.7G roda tudo (Deck, terminais, prod DFL): o paralelismo
    // default da suite saturou a box no freeze de 2026-06-11 (load 130). Um
    // worker a menos que o total de cores deixa a box sempre respirando.
    maxWorkers: 2,
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
      // Regra e motivo em vendor-chunks.ts. O rolldown do Vite 8 só aceita função.
      output: { manualChunks: vendorChunk },
    },
  },
});
