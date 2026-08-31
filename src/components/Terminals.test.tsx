import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Sem comentário: o arquivo explica o lazy em prosa, e um guard que lê prosa como
// código passa (ou falha) pelo motivo errado. `:` antes de `//` preserva URL.
const src = readFileSync(join(__dirname, 'Terminals.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

// Import estático do XtermView põe 334 KB de xterm.js no grafo do entry, e o Vite
// emite `modulepreload` pra ele: baixa em toda visita, inclusive de quem nunca
// abre o painel de terminal. manualChunks separa o arquivo mas NÃO evita isso —
// só o import dinâmico evita.
describe('Terminals: fronteira lazy do xterm', () => {
  it('carrega o XtermView por import dinâmico', () => {
    expect(src).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\/Xterm'\)/);
    expect(src).not.toMatch(/^import\s*\{[^}]*XtermView/m);
  });

  it('envolve o XtermView em Suspense', () => {
    expect(src).toMatch(/<Suspense[\s\S]*<XtermView/);
  });
});
