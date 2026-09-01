import { describe, it, expect } from 'vitest';
import config from './vite.config';

// O React saiu do chunk de vendor sem nenhum teste piscar: a atualização pro 19
// transformou `react-dom/client` em entrada própria, a lista do manualChunks não
// citava ela, e 180 kB voltaram calados pro bundle do app — que é justamente o que
// muda a cada deploy e invalida o cache. Guard de build, não de runtime.

const manualChunks = (config.build?.rollupOptions?.output as { manualChunks: Record<string, string[]> }).manualChunks;

describe('manualChunks', () => {
  it('mantém o React inteiro fora do chunk do app', () => {
    // `react-dom` sozinho não basta: o app importa `react-dom/client`, e é o
    // especificador importado que o Vite casa contra a lista.
    expect(manualChunks.react).toContain('react-dom/client');
    expect(manualChunks.react).toContain('react');
  });

  it('não deixa entrar lib que precisa ficar fora do preload', () => {
    // xterm sai do caminho crítico pelo `lazy()` em Terminals.tsx; ter chunk
    // próprio é o que dá cache separado, não o que tira do preload.
    expect(Object.keys(manualChunks).sort()).toEqual(['react', 'sucrase', 'supabase', 'xterm']);
  });
});
