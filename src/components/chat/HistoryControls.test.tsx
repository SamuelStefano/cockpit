// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { HistoryControls } from './HistoryControls';

afterEach(cleanup);

const base = {
  sessionId: 's1',
  onOpenFull: vi.fn(),
  onLoadOlder: vi.fn(),
  onOpenSummary: vi.fn(),
  setFullLoaded: vi.fn(),
};

describe('HistoryControls', () => {
  it('nomeia os botões por aria-label — no celular o rótulo visível some', () => {
    render(<HistoryControls {...base} fullLoaded={false} truncated />);
    expect(screen.getByRole('button', { name: 'Carregar mensagens antigas' })).toBeTruthy();
  });

  it('troca "ver tudo" por "mostrar resumido" quando o histórico já está completo', () => {
    const { rerender } = render(<HistoryControls {...base} fullLoaded={false} truncated={false} />);
    expect(screen.getByRole('button', { name: 'Ver todas as mensagens' })).toBeTruthy();
    rerender(<HistoryControls {...base} fullLoaded truncated={false} />);
    expect(screen.getByRole('button', { name: 'Mostrar resumido' })).toBeTruthy();
  });
});
