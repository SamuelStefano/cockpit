import { describe, it, expect } from 'vitest';
import type { Session } from '../../data/types';
import { ambiguousIds, titleKey } from './ambiguous';

const s = (id: string, title: string): Session => ({
  id, title, relative: '1d', snippet: '', mtime: 0, hasTerminal: false, active: false,
});

describe('titleKey', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(titleKey('Revisão do PR!')).toBe(titleKey('revisao do pr'));
  });

  it('corta no prefixo: variação no fim continua sendo a mesma chave', () => {
    expect(titleKey('Revisar PR do dfl-schema hoje')).toBe(titleKey('revisar pr do dfl services'));
  });

  it('devolve vazio pra título sem nada aproveitável', () => {
    expect(titleKey('— … —')).toBe('');
  });
});

describe('ambiguousIds', () => {
  it('marca os dois lados de um par de títulos parecidos', () => {
    const got = ambiguousIds([
      s('a', 'Revisar PR do dfl-schema'),
      s('b', 'Revisar PR do dfl-services'),
      s('c', 'Ajustar sidebar do deck'),
    ]);
    expect([...got].sort()).toEqual(['a', 'b']);
  });

  it('não marca nada quando cada título é único', () => {
    expect(ambiguousIds([s('a', 'Deploy do relay'), s('b', 'Corrigir busca')]).size).toBe(0);
  });

  it('não agrupa os sem-título pela chave vazia', () => {
    expect(ambiguousIds([s('a', '???'), s('b', '!!!')]).size).toBe(0);
  });

  it('marca também quem abre a conversa igual, com título diferente', () => {
    const a = { ...s('a', 'Handoff retomado 20260904'), snippet: 'Retome o trabalho a partir do contexto handoff-20260904 e siga' };
    const b = { ...s('b', 'Retoma do contexto'), snippet: 'Retome o trabalho a partir do contexto handoff-20260904 e siga' };
    expect([...ambiguousIds([a, b])].sort()).toEqual(['a', 'b']);
  });

  it('sessão sem abertura não vira par com outra sem abertura', () => {
    expect(ambiguousIds([s('a', 'Deploy do relay'), s('b', 'Corrigir busca')]).size).toBe(0);
  });
});
