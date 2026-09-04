import { describe, it, expect } from 'vitest';
import { resetAtMs, resetPresets, RESET_MARGIN_MS } from './quota-reset';
import type { PlanUsage } from './protocol';

const NOW = new Date('2026-09-04T12:00:00-03:00').getTime();
const usage = (over: Partial<PlanUsage> = {}): PlanUsage => ({
  fiveHour: 80, sevenDay: 50, resetsAt: NOW + 3_600_000, sevenDayResetsAt: NOW + 86_400_000, limits: [], ...over,
});

describe('resetAtMs', () => {
  it('soma a margem depois do reset', () => {
    expect(resetAtMs(usage(), 'fiveHour', NOW)).toBe(NOW + 3_600_000 + RESET_MARGIN_MS);
  });

  // O poll de usage pausa sem browser aberto, então o snapshot em disco pode estar
  // velho. Agendar pra um instante já passado nunca dispararia.
  it('recusa reset no passado (snapshot velho)', () => {
    expect(resetAtMs(usage({ resetsAt: NOW - 10_000 }), 'fiveHour', NOW)).toBeNull();
  });

  it('recusa quando a janela não tem reset conhecido', () => {
    expect(resetAtMs(usage({ sevenDayResetsAt: null }), 'sevenDay', NOW)).toBeNull();
    expect(resetAtMs(null, 'fiveHour', NOW)).toBeNull();
  });
});

describe('resetPresets', () => {
  it('oferece as duas janelas com o tempo restante no rótulo', () => {
    const p = resetPresets(usage(), NOW);
    expect(p.map((x) => x.window)).toEqual(['fiveHour', 'sevenDay']);
    expect(p[0].label).toContain('em 1h');
    expect(p[1].label).toContain('em 1d');
  });

  // Um botão que agenda pro passado é pior que botão nenhum: o usuário acha que
  // guardou o trabalho e o cron nunca roda.
  it('omite a janela cujo reset já passou', () => {
    const p = resetPresets(usage({ resetsAt: NOW - 1 }), NOW);
    expect(p.map((x) => x.window)).toEqual(['sevenDay']);
  });

  it('sem usage não oferece nada', () => {
    expect(resetPresets(null, NOW)).toEqual([]);
  });
});
