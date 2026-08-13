import { describe, it, expect } from 'vitest';
import { escalationReason, ESCALATION_CAP, type AttemptFacts } from './cascade';

const base: AttemptFacts = { tier: 'cheap', failure: 'ok', tools: 3, text: 'pronto', escalations: 0 };

describe('escalationReason', () => {
  it('turno barato que entregou não sobe de tier', () => {
    expect(escalationReason(base)).toBeNull();
  });

  it('sobe quando o provedor barato falhou', () => {
    expect(escalationReason({ ...base, failure: 'transient' })).toBe('falha-do-provedor');
    expect(escalationReason({ ...base, failure: 'quota_exhausted' })).toBe('falha-do-provedor');
  });

  it('sobe quando o turno fechou sem tool e sem texto', () => {
    expect(escalationReason({ ...base, tools: 0, text: '   ' })).toBe('nada-produzido');
  });

  it('texto sem tool é entrega legítima e não sobe', () => {
    expect(escalationReason({ ...base, tools: 0, text: 'a resposta é 42' })).toBeNull();
  });

  it('sobe quando o CLI cortou o turno no teto de voltas', () => {
    expect(escalationReason({ ...base, endReason: 'error_max_turns' })).toBe('teto-do-turno');
    expect(escalationReason({ ...base, endReason: 'error_max_budget' })).toBe('teto-do-turno');
  });

  it('fechamento normal não é teto de turno', () => {
    expect(escalationReason({ ...base, endReason: 'success' })).toBeNull();
  });

  it('stop do usuário nunca sobe de tier', () => {
    expect(escalationReason({ ...base, tools: 0, text: '', userStopped: true })).toBeNull();
    expect(escalationReason({ ...base, failure: 'transient', userStopped: true })).toBeNull();
  });

  it('turno que já era do tier forte não sobe de novo', () => {
    expect(escalationReason({ ...base, tier: 'strong', tools: 0, text: '' })).toBeNull();
  });

  it('respeita o teto de subidas por prompt', () => {
    const falho: AttemptFacts = { ...base, failure: 'transient' };
    expect(escalationReason({ ...falho, escalations: ESCALATION_CAP - 1 })).toBe('falha-do-provedor');
    expect(escalationReason({ ...falho, escalations: ESCALATION_CAP })).toBeNull();
  });
});
