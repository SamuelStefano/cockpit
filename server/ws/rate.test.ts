import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Estado de módulo (lastRate): cada caso reimporta pra começar do zero.
async function fresh() {
  vi.resetModules();
  return import('./rate');
}

describe('cache do rate-limit', () => {
  let rate: Awaited<ReturnType<typeof fresh>>;
  beforeEach(async () => { rate = await fresh(); });
  afterEach(() => vi.useRealTimers());

  it('começa sem snapshot', () => {
    expect(rate.getRateSnapshot()).toBeNull();
    expect(rate.getLastRate()).toBeNull();
  });

  it('guarda o evento e carimba setAt', () => {
    const antes = Date.now();
    rate.setLastRate({ resetsAt: Date.now() + 60_000, status: 'allowed_warning' });
    const snap = rate.getRateSnapshot()!;
    expect(snap.status).toBe('allowed_warning');
    expect(snap.setAt).toBeGreaterThanOrEqual(antes);
  });

  it('getLastRate expõe só o que o cliente precisa (sem setAt)', () => {
    const resetsAt = Date.now() + 60_000;
    rate.setLastRate({ resetsAt, status: 'rejected' });
    expect(rate.getLastRate()).toEqual({ resetsAt, status: 'rejected' });
  });

  it('normaliza status não-string para allowed', () => {
    rate.setLastRate({ resetsAt: Date.now() + 60_000, status: undefined as unknown as string });
    expect(rate.getLastRate()?.status).toBe('allowed');
  });

  // O chip de reset fica SEMPRE à vista; servir uma janela vencida no connect mostraria
  // um reset velho como se fosse o atual.
  it('descarta a janela já vencida na leitura', () => {
    vi.useFakeTimers();
    rate.setLastRate({ resetsAt: Date.now() + 1000, status: 'allowed_warning' });
    expect(rate.getRateSnapshot()).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(rate.getRateSnapshot()).toBeNull();
    expect(rate.getLastRate()).toBeNull();
  });

  it('mantém snapshot sem resetsAt (0), que não tem como vencer', () => {
    rate.setLastRate({ resetsAt: 0, status: 'allowed' });
    expect(rate.getRateSnapshot()?.status).toBe('allowed');
  });

  it('o evento mais novo substitui o anterior', () => {
    rate.setLastRate({ resetsAt: Date.now() + 10_000, status: 'allowed_warning' });
    const novo = Date.now() + 99_000;
    rate.setLastRate({ resetsAt: novo, status: 'rejected' });
    expect(rate.getLastRate()).toEqual({ resetsAt: novo, status: 'rejected' });
  });
});
