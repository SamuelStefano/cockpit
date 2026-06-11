import { describe, it, expect } from 'vitest';
import { suggestCompletion, clipGhost } from './suggest';

describe('suggestCompletion', () => {
  const history = ['deploy para produção', 'rodar os testes', 'rodar o build'];

  it('returns the suffix of the most recent prefix match', () => {
    expect(suggestCompletion(history, 'rodar o')).toBe(' build');
  });

  it('matches case-insensitively but keeps the original casing in the suffix', () => {
    expect(suggestCompletion(['Deploy para Produção'], 'deploy')).toBe(' para Produção');
  });

  it('returns empty for an empty value', () => {
    expect(suggestCompletion(history, '')).toBe('');
  });

  it('returns empty when nothing matches', () => {
    expect(suggestCompletion(history, 'xyz')).toBe('');
  });

  it('returns empty for slash commands', () => {
    expect(suggestCompletion(['/help'], '/he')).toBe('');
  });

  it('returns empty when the value already equals an entry (no suffix to add)', () => {
    expect(suggestCompletion(['rodar os testes'], 'rodar os testes')).toBe('');
  });

  it('returns empty when the value has a line break', () => {
    expect(suggestCompletion(history, 'rodar o\n')).toBe('');
  });

  it('ignores history with no usable prefix', () => {
    expect(suggestCompletion([], 'rodar')).toBe('');
  });
});

describe('clipGhost', () => {
  it('returns short ghosts unchanged', () => {
    expect(clipGhost(' para produção')).toBe(' para produção');
  });

  it('returns empty unchanged', () => {
    expect(clipGhost('')).toBe('');
  });

  it('clips long ghosts at the limit with ellipsis', () => {
    const long = 'a'.repeat(200);
    expect(clipGhost(long)).toBe('a'.repeat(80) + '…');
  });

  it('trims trailing whitespace before the ellipsis', () => {
    const ghost = 'x'.repeat(79) + ' y';
    expect(clipGhost(ghost)).toBe('x'.repeat(79) + '…');
  });

  it('respects a custom max', () => {
    expect(clipGhost('abcdef', 4)).toBe('abcd…');
  });

  it('does not clip at exactly the limit', () => {
    const exact = 'a'.repeat(80);
    expect(clipGhost(exact)).toBe(exact);
  });
});
