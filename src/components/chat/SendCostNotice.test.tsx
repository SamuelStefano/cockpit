// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SendCostNotice } from './SendCostNotice';
import { composerCost } from './send-cost';

afterEach(cleanup);

const NOW = 1_788_500_000_000;
const H3 = 3 * 60 * 60_000;

describe('SendCostNotice', () => {
  it('não renderiza nada quando o envio é barato', () => {
    const cost = composerCost({ ctxTokens: 120_000, lastUsageAt: NOW - 30_000, planUsage: null, now: NOW });
    const { container } = render(<SendCostNotice cost={cost} />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra o preço e sugere migrar quando o cache esfriou', () => {
    const cost = composerCost({ ctxTokens: 681_362, lastUsageAt: NOW - H3, planUsage: null, now: NOW });
    const { container } = render(<SendCostNotice cost={cost} />);
    expect(container.textContent).toContain('cache frio');
    expect(container.textContent).toContain('Migrar a sessão sai mais barato');
  });

  it('avisa que o servidor vai recusar quando não cabe na janela', () => {
    const cost = composerCost({
      ctxTokens: 300_000, lastUsageAt: NOW - H3, now: NOW,
      planUsage: { fiveHour: 99, sevenDay: 0, resetsAt: NOW + 1000, sevenDayResetsAt: NOW, limits: [] },
    });
    const { container } = render(<SendCostNotice cost={cost} />);
    expect(container.textContent).toContain('não cabe no que sobrou');
  });
});
