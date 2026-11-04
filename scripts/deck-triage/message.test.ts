import { describe, expect, it } from 'vitest';
import { deterministicDiagnosis } from './diagnose.ts';
import { findings } from './fixtures.test-util.ts';
import { formatAutoHeal, formatInvestigator, formatTriage, HELP_TEXT } from './message.ts';

describe('formatTriage', () => {
  const f = { ...findings({ login_path: ['fail', 'fechou com 4408'] }), relayLog: ['{"ev":"browser_close"}', '{"ev":"browser_open"}'] };
  const d = deterministicDiagnosis(f);

  it('lists only failing checks and counts the greens', () => {
    const m = formatTriage('Queda', d, f);
    expect(m).toContain('FALHA login no relay');
    expect(m).not.toContain('ok   DNS');
    expect(m).toMatch(/\+\d+ verdes/);
    expect(m).not.toContain('Log do relay');
  });

  it('shows relay log lines only when asked (/status)', () => {
    expect(formatTriage('Status', d, f, { logs: true })).toContain('Log do relay');
  });
});

describe('formatAutoHeal / formatInvestigator / HELP_TEXT', () => {
  it('says what ran and the outcome', () => {
    const m = formatAutoHeal(6 * 60_000, 'restart_relay', 'ok', findings());
    expect(m).toContain('há 6 min');
    expect(m).toContain('Reiniciar relay');
    expect(m).toContain('Rechecagem: voltou');
  });

  it('reports the session id or the failure', () => {
    expect(formatInvestigator({ ok: true, sessionId: 'abc123xyz' })).toContain('abc123xyz');
    expect(formatInvestigator({ ok: false, reason: 'deckctl não respondeu' })).toContain('deckctl não respondeu');
  });

  it('documents the new commands', () => {
    expect(HELP_TEXT).toContain('/investigar');
    expect(HELP_TEXT).toContain('/metricas');
  });
});
