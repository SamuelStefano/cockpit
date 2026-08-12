// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SaturationBanner } from './SaturationBanner';

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
    expect(screen.getByText(/85% da janela \(170k tokens\)/)).toBeTruthy();
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
    expect(screen.getByText(/95% da janela/)).toBeTruthy();
  });

  it('dispensa não vaza para outra sessão', () => {
    render(<SaturationBanner sessionId="107cef43" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispensar/ }));
    cleanup();
    render(<SaturationBanner sessionId="9c8612aa" contextTokens={170_000} busy={false} onHandoff={() => {}} />);
    expect(screen.getByText(/85% da janela/)).toBeTruthy();
  });

  it('trava o botão enquanto a migração roda', () => {
    render(<SaturationBanner sessionId="107cef43" contextTokens={190_000} busy onHandoff={() => {}} />);
    const btn = screen.getByRole('button', { name: /Migrando/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
