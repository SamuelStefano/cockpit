// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SaturationBanner } from './SaturationBanner';

afterEach(cleanup);

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

  it('trava o botão enquanto a migração roda', () => {
    const onHandoff = vi.fn();
    render(<SaturationBanner sessionId="107cef43" contextTokens={190_000} busy onHandoff={onHandoff} />);
    const btn = screen.getByRole('button', { name: /Migrando/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
