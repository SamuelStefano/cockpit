// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamBot } from '../../../../shared/protocol';
import type { BotView } from '../../../routes/equipe/team-view';
import { SpacesRail, type SpacesRailProps } from './SpacesRail';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function view(id: string, over: Partial<BotView> = {}, bot: Partial<TeamBot> = {}): BotView {
  const b = { id, name: `Bot ${id}`, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...bot } as TeamBot;
  return { bot: b, key: id, preview: '', unread: false, state: 'idle', ...over };
}

function setup(over: Partial<SpacesRailProps> = {}) {
  const props: SpacesRailProps = {
    bitState: 'idle', views: [view('a'), view('b')], selectedAgentId: null, onAll: vi.fn(), onAgent: vi.fn(), onAddBox: vi.fn(),
    collapsed: false, onExpand: vi.fn(), onNew: vi.fn(), chatSessions: [], activeChatId: '', onSelectChat: vi.fn(),
    role: 'root', route: '/', nav: vi.fn(), pendingCount: 0, onPalette: vi.fn(), account: {}, conn: 'connected', ...over,
  };
  render(<SpacesRail {...props} />);
  return props;
}

describe('SpacesRail', () => {
  it('puts Bit, every conversation and the agents on top', () => {
    const p = setup();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names.slice(0, 4)).toEqual(['Ir pro chat', 'Todas as conversas', 'Bot a', 'Bot b']);
    fireEvent.click(screen.getByRole('button', { name: 'Bot b' }));
    expect(p.onAgent).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Todas as conversas' }));
    expect(p.onAll).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ir pro chat' }));
    expect(p.nav).toHaveBeenCalledWith('/');
  });

  it('marks the open space', () => {
    setup({ selectedAgentId: 'b' });
    expect(screen.getByRole('button', { name: 'Bot b' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Todas as conversas' }).getAttribute('aria-current')).toBeNull();
  });

  it('shows seven agents and lists all of them by department behind +N', () => {
    const views = Array.from({ length: 9 }, (_, i) => view(`b${i}`, { endedAt: i }, i === 0 ? { department: 'engineering' } : {}));
    const p = setup({ views });
    fireEvent.click(screen.getByRole('button', { name: 'Mais 2 agentes' }));
    const pop = screen.getByRole('dialog', { name: 'Todos os agentes' });
    expect(within(pop).getByRole('region', { name: 'Engenharia' })).toBeTruthy();
    expect(within(pop).getByRole('region', { name: 'Sem setor' })).toBeTruthy();
    expect(within(pop).getAllByRole('button')).toHaveLength(9);
    fireEvent.click(within(pop).getByRole('button', { name: 'Bot b0' }));
    expect(p.onAgent).toHaveBeenCalledWith('b0');
  });

  it('offers a new agent only when the caller allows it', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Novo agente' })).toBeNull();
    cleanup();
    const p = setup({ onNewAgent: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(p.onNewAgent).toHaveBeenCalledOnce();
  });

  it('routes the bottom buttons and counts pending agents on Equipe', () => {
    const p = setup({ pendingCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Trabalho' }));
    expect(p.nav).toHaveBeenCalledWith('/canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Equipe' }));
    expect(p.nav).toHaveBeenCalledWith('/equipe');
    expect(screen.getByLabelText('2 pendentes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Explorar' }));
    expect(p.nav).toHaveBeenCalledWith('/explorar');
    fireEvent.click(screen.getByRole('button', { name: /^Comandos/ }));
    expect(p.onPalette).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    expect(p.nav).toHaveBeenCalledWith('/configuracoes');
  });

  it('keeps every account-menu route in the profile menu', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    const names = within(screen.getByRole('navigation', { name: 'Rotas' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Canvas', 'Pull requests', 'Pontos', 'Loja', 'Rotinas']);
  });

  it('never shows a student a route they cannot open', () => {
    setup({ role: 'student' });
    for (const name of ['Trabalho', 'Equipe', 'Explorar']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Comandos/ })).toBeTruthy();
  });

  it('carries expand, new chat and the running chats while the side is collapsed', () => {
    const chat = { id: 's1', title: 'Rodando', relative: 'agora', snippet: '', mtime: 1, hasTerminal: false, active: false };
    const p = setup({ collapsed: true, chatSessions: [chat], chatRunning: new Set(['s1']) });
    fireEvent.click(screen.getByRole('button', { name: 'Expandir barra lateral' }));
    expect(p.onExpand).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(p.onNew).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Rodando' }));
    expect(p.onSelectChat).toHaveBeenCalledWith('s1');
  });

  it('hides the collapsed-only controls while the side is open', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Expandir barra lateral' })).toBeNull();
  });
});
