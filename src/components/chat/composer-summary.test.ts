import { describe, it, expect } from 'vitest';
import { composerSummary } from './composer-summary';

const models = [{ id: 'claude-opus-4-5', displayName: 'Claude Opus 4.5' }];

describe('composerSummary', () => {
  it('mostra o modelo escolhido e o esforço em minúsculo', () => {
    expect(composerSummary('claude-opus-4-5', models, 'low')).toBe('Claude Opus 4.5 · baixo');
  });

  it('modelo fora da lista da conta (id digitado à mão) ainda vira rótulo legível', () => {
    expect(composerSummary('claude-fable-5', [], 'xhigh')).toBe('Fable 5 · muito alto');
  });

  it('alias puro do CLI não vira string vazia', () => {
    expect(composerSummary('sonnet', [], 'max')).toBe('Sonnet · máximo');
  });

  it('sem modelo definido cai num rótulo genérico em vez de " · baixo"', () => {
    expect(composerSummary('', [], 'low')).toBe('modelo · baixo');
  });
});
