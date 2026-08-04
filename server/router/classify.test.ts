import { describe, it, expect } from 'vitest';
import { classifyOutcome, failureSignal, parseResetHint } from './classify';

const turn = (o: Partial<Parameters<typeof classifyOutcome>[0]>) =>
  classifyOutcome({ limited: false, tools: 0, text: '', ...o });

describe('classifyOutcome', () => {
  it('turno que trabalhou é ok mesmo se o texto casa o regex de limite', () => {
    expect(turn({ tools: 3, text: 'expliquei o que é rate limit e usage limit reached na API' })).toBe('ok');
  });

  it('resposta longa sobre limite não é bailout', () => {
    expect(turn({ text: `usage limit reached ${'x'.repeat(500)}` })).toBe('ok');
  });

  it('bailout curto de teto vira rate_limit', () => {
    expect(turn({ text: 'Claude usage limit reached. Your limit will reset at 3pm.' })).toBe('rate_limit');
  });

  it('crédito acabado vira quota_exhausted, não rate_limit', () => {
    expect(turn({ error: 'claude saiu (1): Your credit balance is too low to access the API' })).toBe('quota_exhausted');
    expect(turn({ error: 'error: insufficient_quota' })).toBe('quota_exhausted');
    expect(turn({ error: 'cota diária esgotada, tente amanhã' })).toBe('quota_exhausted');
  });

  it('auth ganha de quota quando os dois aparecem (credencial morta não espera reset)', () => {
    expect(turn({ error: '401 invalid api key — no credits' })).toBe('auth');
  });

  it('erro de rede vira transient', () => {
    expect(turn({ error: 'claude saiu (1): fetch failed ECONNRESET' })).toBe('transient');
    expect(turn({ error: '503 service unavailable' })).toBe('transient');
  });

  it('rate_limit_event sem nada produzido vira rate_limit', () => {
    expect(turn({ limited: true })).toBe('rate_limit');
  });

  it('rate_limit_event com resposta de verdade é ok (o turno rodou)', () => {
    expect(turn({ limited: true, tools: 1, text: 'pronto' })).toBe('ok');
  });

  it('turno vazio sem sinal nenhum é ok (morte silenciosa é outro tratamento)', () => {
    expect(turn({})).toBe('ok');
  });
});

describe('failureSignal', () => {
  it('ignora a resposta quando houve tool (não foi bailout)', () => {
    expect(failureSignal({ limited: false, tools: 2, text: 'rate limit', error: '' })).toBe('');
  });

  it('sempre inclui o stderr', () => {
    expect(failureSignal({ limited: false, tools: 9, text: 'ok', error: 'boom' })).toBe('boom');
  });
});

describe('parseResetHint', () => {
  const now = 1_700_000_000_000;

  it('lê retry-after em segundos', () => {
    expect(parseResetHint('retry-after: 90', now)).toBe(90_000);
  });

  it('lê duração relativa composta', () => {
    expect(parseResetHint('rate limited, try again in 2h30m', now)).toBe(2.5 * 3_600_000);
  });

  it('lê unidade por extenso', () => {
    expect(parseResetHint('resets in 45 minutes', now)).toBe(45 * 60_000);
  });

  it('lê timestamp ISO futuro', () => {
    const iso = new Date(now + 3_600_000).toISOString();
    expect(parseResetHint(`resets at ${iso}`, now)).toBe(3_600_000);
  });

  it('ignora ISO no passado', () => {
    expect(parseResetHint(`resets at ${new Date(now - 5000).toISOString()}`, now)).toBeNull();
  });

  it('trata "tente amanhã" como espera longa', () => {
    expect(parseResetHint('quota exceeded, try again tomorrow', now)).toBe(12 * 3_600_000);
  });

  it('limita dica absurda a 7 dias', () => {
    expect(parseResetHint('retry-after: 99999999', now)).toBe(7 * 24 * 3_600_000);
  });

  it('sem dica devolve null', () => {
    expect(parseResetHint('erro genérico', now)).toBeNull();
    expect(parseResetHint('', now)).toBeNull();
  });
});
