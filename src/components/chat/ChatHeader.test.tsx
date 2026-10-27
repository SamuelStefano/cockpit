// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatHeader } from './ChatHeader';

afterEach(cleanup);

const session = { id: 's1', title: 'Minha conversa' } as never;
const msgs = [{ id: 'm1', role: 'user', text: 'oi' }] as never;

function setup(over: Partial<Parameters<typeof ChatHeader>[0]> = {}) {
  render(
    <ChatHeader
      session={session} messages={msgs} isEmpty={false} isMobile={false} contextTokens={0}
      onNew={vi.fn()} fullLoaded={false} setFullLoaded={vi.fn()} {...over}
    />,
  );
}

describe('ChatHeader', () => {
  it('is a single line with the title and a menu, no message icon or badges', () => {
    setup();
    expect(screen.getByLabelText('Renomear sessão: Minha conversa')).toBeTruthy();
    expect(screen.getByLabelText('Mais ações da conversa')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir terminais')).toBeNull();
    expect(screen.queryByText('terminal')).toBeNull();
  });

  it('puts turn stats, history and export inside the menu', () => {
    setup({ lastTurn: { costUsd: 0.0123, durationMs: 4200, model: 'claude-opus-4-8' }, onOpenFull: vi.fn() });
    expect(screen.queryByText(/Último turno/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    expect(screen.getByText(/Último turno: \$0\.012 · 4\.2s · opus/)).toBeTruthy();
    expect(screen.getByLabelText('Ver todas as mensagens')).toBeTruthy();
    expect(screen.getByTitle('Baixar conversa em PDF')).toBeTruthy();
  });

  it('closes the menu after an action', () => {
    const onOpenFull = vi.fn();
    setup({ onOpenFull });
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    fireEvent.click(screen.getByLabelText('Ver todas as mensagens'));
    expect(onOpenFull).toHaveBeenCalledWith('s1');
    expect(screen.queryByLabelText('Ver todas as mensagens')).toBeNull();
  });

  it('hides the menu when there is nothing to show', () => {
    setup({ isEmpty: true });
    expect(screen.queryByLabelText('Mais ações da conversa')).toBeNull();
  });

  it('shows the terminal button only with a handler, with a live dot when running', () => {
    const onTerminal = vi.fn();
    setup({ onTerminal });
    fireEvent.click(screen.getByLabelText('Abrir terminais'));
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it('surfaces the new-session action over the context limit', () => {
    const onNew = vi.fn();
    setup({ contextTokens: 900_000, contextModel: 'claude-opus-4-8', onNew });
    fireEvent.click(screen.getByText('nova sessão'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('shows the agent instead of the session title and offers its profile in the menu', () => {
    const onProfile = vi.fn();
    setup({ agent: { name: 'Capo', avatar: <span>mascote</span>, onProfile, profileOpen: false } });
    expect(screen.queryByLabelText('Renomear sessão: Minha conversa')).toBeNull();
    expect(screen.getByText('Capo')).toBeTruthy();
    expect(screen.getByText('mascote')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    const item = screen.getByRole('button', { name: 'Perfil do agente' });
    expect(item.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(item);
    expect(onProfile).toHaveBeenCalledOnce();
  });
});

describe('ChatHeader phone bar', () => {
  const base = { session: { id: 's1', title: 'Relatório' } as never, messages: [], isEmpty: false, isMobile: true, contextTokens: 0, onNew: vi.fn(), fullLoaded: false, setFullLoaded: vi.fn() };

  it('shows ☰ · title · one "…" action, no context ring or terminal button', () => {
    const onMenu = vi.fn();
    render(<ChatHeader {...base} onMenu={onMenu} onTerminal={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onMenu).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Mais ações da conversa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir terminais' })).toBeNull();
  });

  it('on a fresh chat the action is "+" and the title is Deck', () => {
    const onNew = vi.fn();
    render(<ChatHeader {...base} isEmpty onNew={onNew} onMenu={vi.fn()} />);
    expect(screen.getByText('Deck')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
