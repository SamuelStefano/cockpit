// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UsagePanel } from './UsagePanel';
import { usageRows } from './usage-rows';
import type { PlanUsage } from '../../../shared/protocol';

const base: PlanUsage = { fiveHour: 19, sevenDay: 76, resetsAt: 1000, sevenDayResetsAt: 2000, limits: [] };

describe('UsagePanel bloqueado', () => {
  it('diz que a conta recusou, em vez de fingir que está lendo', () => {
    const html = renderToStaticMarkup(<UsagePanel rows={[]} blockedUntil={Date.now() + 10 * 60_000} />);
    expect(html).toContain('recusou a leitura');
    expect(html).not.toContain('Lendo da conta');
  });

  it('bloqueio já vencido volta pro texto de carregamento', () => {
    const html = renderToStaticMarkup(<UsagePanel rows={[]} blockedUntil={Date.now() - 1000} />);
    expect(html).toContain('Lendo da conta');
  });

  it('com número em mão, marca que ele é da última leitura', () => {
    const rows = usageRows(base);
    const html = renderToStaticMarkup(<UsagePanel rows={rows} blockedUntil={Date.now() + 10 * 60_000} />);
    expect(html).toContain('última leitura');
  });
});
