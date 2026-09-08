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

  it('com número em mão, diz a idade dele e o quanto falta pra tentar de novo', () => {
    const rows = usageRows(base);
    const html = renderToStaticMarkup(
      <UsagePanel rows={rows} blockedUntil={Date.now() + 10 * 60_000} readAt={Date.now() - 42 * 60_000} />,
    );
    expect(html).toContain('lido há 42min');
    expect(html).toContain('tento em 10min');
  });

  // Sem bloqueio o poll também para (agente fora do ar, browser fechado) e o
  // número velho não tinha nada que o denunciasse.
  it('mostra a idade da leitura mesmo sem bloqueio', () => {
    const html = renderToStaticMarkup(<UsagePanel rows={usageRows(base)} readAt={Date.now() - 90 * 60_000} />);
    expect(html).toContain('lido há 1h30');
  });
});
