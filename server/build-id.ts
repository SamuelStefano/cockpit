import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// Manifesto de build do bundle que o servidor está servindo AGORA.
//
// O Deck é PWA: não há bundle pra baixar e trocar como num app de loja — o
// navegador já busca tudo da origem, e o service worker (vite-plugin-pwa com
// globPatterns vazio) não guarda nada. O que falta pro "OTA" é só o SINAL: a PWA
// instalada na home screen do iPhone fica aberta por dias e nunca recarrega, então
// um deploy novo no disco não chega até ela. Este endpoint é esse sinal.
//
// A identidade do bundle é o ENTRY do Vite (`/assets/index-<hash>.js`): o nome já
// carrega o hash do conteúdo, e o cliente sabe qual carregou lendo a própria tag
// <script> do DOM. Comparar entry servido × entry carregado não tem corrida (um
// build-id injetado em tempo de build só seria lido DEPOIS do boot, e um deploy
// nessa janela passaria batido) e não exige mudar o build.
//
// Integridade não é hash de payload aqui porque não há payload: o código veio da
// MESMA origem por HTTPS, que é a garantia que o navegador dá. O sha do index.html
// entra como identidade estável do deploy (dois builds com o mesmo entry mas
// index.html diferente ainda contam como versões diferentes), não como checksum
// de algo que o cliente baixa por fora.

export interface BuildManifest {
  entry: string | null;
  sha256: string;
  builtAt: number;
}

const ENTRY_RE = /<script[^>]+type="module"[^>]*\ssrc="(\/assets\/[^"]+\.js)"/;

export function parseBuild(html: string, builtAt: number): BuildManifest {
  return {
    entry: ENTRY_RE.exec(html)?.[1] ?? null,
    sha256: createHash('sha256').update(html).digest('hex'),
    builtAt,
  };
}

// Cache por mtime: o endpoint é consultado em todo foco da aba e a cada minuto por
// cliente. Um stat por chamada é barato; ler e hashear o index.html não é.
let cached: { mtimeMs: number; manifest: BuildManifest } | null = null;

export function buildManifest(distDir: string): BuildManifest | null {
  const file = join(distDir, 'index.html');
  let st;
  try { st = statSync(file); } catch { return null; }
  if (cached?.mtimeMs === st.mtimeMs) return cached.manifest;
  let html: string;
  try { html = readFileSync(file, 'utf8'); } catch { return null; }
  const manifest = parseBuild(html, Math.round(st.mtimeMs));
  cached = { mtimeMs: st.mtimeMs, manifest };
  return manifest;
}

export function resetBuildCache(): void {
  cached = null;
}
