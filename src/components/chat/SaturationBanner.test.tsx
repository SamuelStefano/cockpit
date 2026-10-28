// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SaturationBanner } from './SaturationBanner';
import { composerCost } from './send-cost';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('SaturationBanner', () => {
  it('não aparece com folga na janela', () => {
    const { container } = render(<SaturationBanner sessionId="107cef43" contextTokens={100_000} busy={false} onHandoff={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('não aparece em sessão que ainda não existe no servidor', () => {
    const { container } = render(<SaturationBanner sessionId="new-abc" contextTokens={190_000} busy={false} onHandoff={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra o quanto da janela já foi e migra no clique', () => {
    const onHandoff = vi.fn();
    render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={onHandoff} />);
    expect(screen.getByText(/Sessão lotada 85% \(170k\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Migrar/ }));
    expect(onHandoff).toHaveBeenCalledWith('107cef43');
  });

  it('só explica o porquê quando o usuário expande', () => {
    render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    expect(screen.queryByText(/reenvia quase todo esse contexto/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText(/reenvia quase todo esse contexto/)).toBeTruthy();
  });

  it('some ao dispensar', () => {
    const { container } = render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispensar/ }));
    expect(container.firstChild).toBeNull();
  });

  it('volta a avisar quando a janela fica crítica', () => {
    render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispensar/ }));
    cleanup();
    render(<SaturationBanner sessionId="107cef43" contextTokens={190_000} busy={false} onHandoff={() => {}} />);
    expect(screen.getByText(/Sessão lotada 95%/)).toBeTruthy();
  });

  it('dispensa não vaza para outra sessão', () => {
    render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispensar/ }));
    cleanup();
    render(<SaturationBanner sessionId="9c8612aa" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    expect(screen.getByText(/Sessão lotada 85%/)).toBeTruthy();
  });

  it('trava o botão enquanto a migração roda', () => {
    render(<SaturationBanner sessionId="107cef43" contextTokens={190_000} busy onHandoff={() => {}} />);
    const btn = screen.getByRole('button', { name: /Migrando/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  describe('with the next-send cost', () => {
    const NOW = 1_788_500_000_000;
    const H3 = 3 * 60 * 60_000;

    it('renders nothing when both are quiet', () => {
      const cost = composerCost({ ctxTokens: 120_000, lastUsageAt: NOW - 30_000, planUsage: null, now: NOW });
      const { container } = render(<SaturationBanner sessionId="107cef43" contextTokens={100_000} busy={false} onHandoff={() => {}} cost={cost} />);
      expect(container.firstChild).toBeNull();
    });

    it('folds saturation and price into one line with a single Migrar', () => {
      const cost = composerCost({ ctxTokens: 681_362, lastUsageAt: NOW - H3, planUsage: null, now: NOW });
      render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={() => {}} cost={cost} />);
      expect(screen.getByText(/Sessão lotada 85%.*Próximo envio/)).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Migrar' })).toHaveLength(1);
    });

    it('shows the price alone and warns when it does not fit the window', () => {
      const cost = composerCost({
        ctxTokens: 300_000, lastUsageAt: NOW - H3, now: NOW,
        planUsage: { fiveHour: 99, sevenDay: 0, resetsAt: NOW + 1000, sevenDayResetsAt: NOW, limits: [] },
      });
      const { container } = render(<SaturationBanner sessionId="107cef43" contextTokens={100_000} busy={false} cost={cost} />);
      expect(container.textContent).toContain('não cabe no que sobrou');
    });
  });
});
