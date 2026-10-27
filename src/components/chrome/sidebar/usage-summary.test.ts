import { describe, it, expect, vi, afterEach } from 'vitest';
import { usageSummary } from './usage-summary';
import type { PlanUsage } from '../../../../shared/protocol';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const plan = (fiveHour: number, resetsAt = NOW + 3 * 3600_000): PlanUsage => ({ fiveHour, resetsAt } as PlanUsage);

afterEach(() => vi.useRealTimers());

describe('usageSummary', () => {
  it('reads "lendo" while there is no number', () => {
    const s = usageSummary({ usage: null, agent: 'claude' });
    expect(s.pct).toBeNull();
    expect(s.tone).toBe('idle');
    expect(s.aria).toBe('Uso do plano: lendo');
  });

  it('puts percentage and reset in the tip, and tones by threshold', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const s = usageSummary({ usage: plan(72), agent: 'claude', readAt: NOW });
    expect(s.pct).toBe(72);
    expect(s.tone).toBe('mid');
    expect(s.tip).toMatch(/^Uso do plano: 72% · reseta em /);
    expect(usageSummary({ usage: plan(95), agent: 'claude', readAt: NOW }).tone).toBe('high');
  });

  it('treats a turned window as unknown', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const s = usageSummary({ usage: plan(80, NOW - 1000), agent: 'claude' });
    expect(s.pct).toBeNull();
    expect(s.tone).toBe('idle');
  });

  it('greys an old reading and shows its age', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const s = usageSummary({ usage: plan(40), agent: 'claude', readAt: NOW - 30 * 60_000 });
    expect(s.tone).toBe('idle');
    expect(s.tip).toMatch(/lido há /);
  });

  it('flags a paused quota and names Grok', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const s = usageSummary({ usage: plan(99), agent: 'grok', readAt: NOW, paused: true, quotaResetsAt: NOW + 3600_000 });
    expect(s.aria).toMatch(/^Uso do Grok: 99% — cota esgotada, reseta /);
    expect(s.tip.startsWith('Cota esgotada')).toBe(true);
  });
});
