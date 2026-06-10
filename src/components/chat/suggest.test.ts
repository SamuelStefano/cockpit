import { describe, it, expect } from 'vitest';
import { suggestCompletion } from './suggest';

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
