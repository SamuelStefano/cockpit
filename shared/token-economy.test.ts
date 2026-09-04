import { describe, it, expect } from 'vitest';
import { HARNESS_CHECKS, LEVERS } from './token-economy';

describe('catálogo de economia de contexto', () => {
  it('não tem id de check repetido', () => {
    const ids = HARNESS_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // O probe é o que separa auditoria de opinião: um check sem comando que responda a
  // pergunta vira palpite, e palpite não mede economia.
  it('todo check traz um probe executável e o motivo', () => {
    for (const c of HARNESS_CHECKS) {
      expect(c.probe.trim()).not.toBe('');
      expect(c.why.trim()).not.toBe('');
      expect(c.title).toMatch(/\?$/);
    }
  });

  it('toda alavanca declara o ganho', () => {
    for (const l of LEVERS) expect(l.gain.trim()).not.toBe('');
  });
});
