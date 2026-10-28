// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Connection } from '../../shared/connections';
import { Conexoes } from './Conexoes';

afterEach(cleanup);

const items: Connection[] = [
  { id: 'provider:claude', kind: 'provider', label: 'Claude', state: 'connected', lastUsed: Date.now() - 40_000 },
  { id: 'tool:work', kind: 'tool', label: 'dfl-work', state: 'expired', detail: 'precisa entrar de novo' },
  { id: 'machine:self', kind: 'machine', label: 'vps', state: 'connected', detail: 'esta máquina' },
];

function mount(over: Partial<React.ComponentProps<typeof Conexoes>> = {}) {
  const p = { connected: true, items, loaded: true, bots: [], dflMcpsState: null, dflMcpsBusy: false, onGet: vi.fn(), onToolAdd: vi.fn(), onGo: vi.fn(), ...over };
  return { ...render(<Conexoes {...p} />), p };
}

describe('Conexoes', () => {
  it('asks for the list and shows the notice', () => {
    const { p, container } = mount();
    expect(p.onGet).toHaveBeenCalled();
    expect(container.textContent).toContain('1 conexão precisa de você.');
  });

  it('Resolver jumps to the tab of the first problem and re-login adds the tool', () => {
    const { p } = mount();
    fireEvent.click(screen.getByText('Resolver'));
    fireEvent.click(screen.getByText('Entrar de novo'));
    expect(p.onToolAdd).toHaveBeenCalledWith(['work']);
  });

  it('hides Chaves without key items and keeps dev words out of the main copy', () => {
    const { container } = mount();
    expect(screen.queryByText('Chaves')).toBeNull();
    expect(container.textContent).not.toMatch(/MCP|token|host/i);
  });

  it('empty provider tab offers the first connection via onboarding', () => {
    const { p } = mount({ items: [] });
    expect(screen.getByText('Nenhum provedor ainda')).toBeTruthy();
    fireEvent.click(screen.getByText('Conectar o primeiro'));
    expect(p.onGo).toHaveBeenCalledWith('/onboarding');
  });

  it('shows a provider off row with Ligar and routes to onboarding', () => {
    const { p } = mount({ items: [{ id: 'provider:ollama', kind: 'provider', label: 'Ollama', state: 'off' }] });
    fireEvent.click(screen.getByText('Ligar'));
    expect(p.onGo).toHaveBeenCalledWith('/onboarding');
  });
});
