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
  });

  it('puts turn stats, history and export inside the menu', () => {
    setup({ lastTurn: { costUsd: 0.0123, durationMs: 4200, model: 'claude-opus-4-8' }, onOpenFull: vi.fn() });
    expect(screen.queryByText(/Último turno/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    expect(screen.getByText(/\$0\.012 · 4\.2s · opus/)).toBeTruthy();
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

  it('toggles the terminal from a header button, only with a handler, and not from the menu', () => {
    const onTerminal = vi.fn();
    setup({ onTerminal });
    fireEvent.click(screen.getByLabelText('Abrir terminais'));
    expect(onTerminal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    expect(screen.getAllByLabelText('Abrir terminais')).toHaveLength(1);
  });

  it('always renders the context ring and nova sessão, even with no context yet', () => {
    setup({ contextTokens: 0 });
    expect(screen.getByRole('button', { name: /nova sessão/ })).toBeTruthy();
    expect(screen.getByLabelText(/^Contexto 0%/)).toBeTruthy();
  });

  it('shows the plan usage ring in the header', () => {
    setup({ usage: { planUsage: null, stats: null } });
    expect(screen.getByRole('button', { name: /^Uso do plano/ })).toBeTruthy();
  });

  it('renames from the menu by focusing the title input', () => {
    setup({ onRename: vi.fn() });
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }));
    expect(screen.getByLabelText('Nome da sessão')).toBeTruthy();
  });

  it('asks before deleting and deletes the open session', () => {
    const onDelete = vi.fn();
    setup({ onDelete });
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apagar conversa' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    expect(onDelete).toHaveBeenCalledWith('s1');
  });

  it('shows the context row in the menu', () => {
    setup({ contextTokens: 100_000, contextModel: 'claude-opus-4-8' });
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    expect(screen.getAllByRole('meter').length).toBeGreaterThan(1);
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
    const item = screen.getByRole('menuitem', { name: 'Perfil do agente' });
    expect(item.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(item);
    expect(onProfile).toHaveBeenCalledOnce();
  });

  it('puts "Pausar agentes" in the agent menu and flips it to "Retomar agentes"', () => {
    const onSet = vi.fn();
    setup({ agent: { name: 'Capo', avatar: <span>m</span>, pause: { paused: false, onSet } } });
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pausar agentes' }));
    expect(onSet).toHaveBeenCalledWith(true);
    cleanup();
    setup({ agent: { name: 'Capo', avatar: <span>m</span>, pause: { paused: true, onSet } } });
    fireEvent.click(screen.getByLabelText('Mais ações da conversa'));
    expect(screen.getByRole('menuitem', { name: 'Retomar agentes' })).toBeTruthy();
  });
});

describe('ChatHeader phone bar', () => {
  const base = { session: { id: 's1', title: 'Relatório' } as never, messages: [], isEmpty: false, isMobile: true, contextTokens: 0, onNew: vi.fn(), fullLoaded: false, setFullLoaded: vi.fn() };

  it('shows ☰ · title · one "…" action, the terminal button, no "…" duplicate', () => {
    const onMenu = vi.fn();
    render(<ChatHeader {...base} onMenu={onMenu} onTerminal={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onMenu).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Mais ações da conversa' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Abrir terminais' })).toHaveLength(1);
  });

  it('on a fresh chat the action is "+" and the title is Deck', () => {
    const onNew = vi.fn();
    render(<ChatHeader {...base} isEmpty onNew={onNew} onMenu={vi.fn()} />);
    expect(screen.getByText('Deck')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
