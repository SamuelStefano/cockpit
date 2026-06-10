import { describe, it, expect } from 'vitest';
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
