// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appendPrompt } from './prompt-history';

describe('appendPrompt', () => {
  it('adiciona prompt trimado no fim', () => {
    expect(appendPrompt(['a'], '  b  ')).toEqual(['a', 'b']);
  });

  it('rejeita vazio, slash-command e multilinha (retorna a mesma lista)', () => {
    const list = ['a'];
    expect(appendPrompt(list, '   ')).toBe(list);
    expect(appendPrompt(list, '/model opus')).toBe(list);
    expect(appendPrompt(list, 'linha um\nlinha dois')).toBe(list);
  });

  it('rejeita prompt acima do cap de chars (paste gigante)', () => {
    const list = ['a'];
    expect(appendPrompt(list, 'x'.repeat(1001))).toBe(list);
  });

  it('dedupa movendo o repetido pro fim (mais recente)', () => {
    expect(appendPrompt(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });

  it('respeita o teto descartando os mais antigos', () => {
    expect(appendPrompt(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd']);
  });
});

// resetModules por teste: o cache do módulo é singleton e simularia uma aba
// que já carregou o histórico — exatamente o que cada cenário precisa controlar.
describe('recordPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('persiste o prompt no storage', async () => {
    const mod = await import('./prompt-history');
    mod.recordPrompt('deploy');
    expect(JSON.parse(localStorage.getItem('cockpit:promptHistory')!)).toEqual(['deploy']);
  });

  it('não sobrescreve o que outra aba gravou depois do load (relê antes de mesclar)', async () => {
    const mod = await import('./prompt-history');
    mod.loadPromptHistory(); // popula o cache desta "aba" (vazio)
    localStorage.setItem('cockpit:promptHistory', JSON.stringify(['deploy'])); // outra aba grava
    mod.recordPrompt('build');
    expect(JSON.parse(localStorage.getItem('cockpit:promptHistory')!)).toEqual(['deploy', 'build']);
  });

  it('prompt rejeitado (slash) não toca o storage', async () => {
    const mod = await import('./prompt-history');
    localStorage.setItem('cockpit:promptHistory', JSON.stringify(['a']));
    mod.recordPrompt('/model opus');
    expect(JSON.parse(localStorage.getItem('cockpit:promptHistory')!)).toEqual(['a']);
  });

  it('loadPromptHistory reflete o que recordPrompt acabou de gravar', async () => {
    const mod = await import('./prompt-history');
    mod.recordPrompt('um');
    mod.recordPrompt('dois');
    expect(mod.loadPromptHistory()).toEqual(['um', 'dois']);
  });
});
