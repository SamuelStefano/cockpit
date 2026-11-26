// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamBot } from '../../../../shared/protocol';
import type { BotView } from '../../../routes/equipe/team-view';
import { DesktopShell, type DesktopShellProps } from './DesktopShell';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function view(id: string, over: Partial<BotView> = {}, bot: Partial<TeamBot> = {}): BotView {
  const b = { id, name: `Bot ${id}`, label: 'Revisa PRs', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, sessionId: `s-${id}`, ...bot } as TeamBot;
  return { bot: b, key: `s-${id}`, preview: '', unread: false, state: 'idle', ...over };
}

const session = (id: string, title: string) => ({ id, title, relative: 'há 2 h', snippet: '', mtime: 1, hasTerminal: false, active: false });

function setup(over: Partial<DesktopShellProps> = {}) {
  const props: DesktopShellProps = {
    route: '/', nav: vi.fn(), navAgent: vi.fn(), role: 'root', bitState: 'idle', conn: 'connected', account: {},
    onNew: vi.fn(), onPalette: vi.fn(), agents: [view('a', {}, { previousSessionIds: ['old-1', 'gone'], model: 'opus', department: 'engineering' }), view('b', {}, { parentId: 'a' })],
    activeAgentId: null, onOpenAgent: vi.fn(), onRotateAgent: vi.fn(), sessionsPanel: <div>lista de conversas</div>,
    chatSessions: [], sessions: [session('s-a', 'Thread atual'), session('old-1', 'Thread antiga')], activeSessionId: '', onSelectSession: vi.fn(), ...over,
  };
  const r = render(<DesktopShell {...props} />);
  return { props, ...r };
}

const rotateButton = () => screen.queryAllByRole('button', { name: 'Nova conversa' }).find((b) => b.textContent === 'Nova conversa') as HTMLButtonElement;

describe('DesktopShell', () => {
  it('shows every conversation by default with Nova and Gerenciar agentes', () => {
    const { props } = setup();
    expect(screen.getByText('lista de conversas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(props.onNew).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar agentes' }));
    expect(props.nav).toHaveBeenCalledWith('/agentes');
  });

  it('opens an agent space on avatar click and goes back without navigating', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Bot a' }));
    expect(props.onOpenAgent).toHaveBeenCalledWith('a');
    expect(screen.getByRole('heading', { name: 'Bot a' })).toBeTruthy();
    expect(screen.getByText('chefe')).toBeTruthy();
    expect(screen.getByText('opus · Engenharia')).toBeTruthy();
    expect(screen.queryByText('lista de conversas')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Todas as conversas' }));
    expect(screen.getByText('lista de conversas')).toBeTruthy();
    expect(props.nav).not.toHaveBeenCalled();
  });

  it('lists the current thread and the older ones the box still has', () => {
    const { props } = setup({ activeAgentId: 'a' });
    fireEvent.click(screen.getByText('Thread atual'));
    expect(props.onOpenAgent).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByText('Thread antiga'));
    expect(props.onSelectSession).toHaveBeenCalledWith('old-1');
    expect(screen.getAllByRole('button').filter((b) => b.textContent?.includes('Thread'))).toHaveLength(2);
  });

  it('opens the workspace and the profile', () => {
    const { props } = setup({ activeAgentId: 'a' });
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arquivos do agente' }));
    expect(props.navAgent).toHaveBeenCalledWith('a', 'arquivos');
    fireEvent.click(screen.getByRole('button', { name: 'Perfil do agente' }));
    expect(props.navAgent).toHaveBeenCalledWith('a');
  });

  it('starts the agent over only after confirming', () => {
    const { props } = setup({ activeAgentId: 'a' });
    fireEvent.click(rotateButton());
    expect(props.onRotateAgent).not.toHaveBeenCalled();
    expect(screen.getByText('Começar do zero? A conversa atual fica no histórico.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(props.onRotateAgent).toHaveBeenCalledWith('a');
  });

  it('disables the fresh start while the agent works and hides it without the action', () => {
    setup({ activeAgentId: 'a', agents: [view('a', { state: 'working' })] });
    expect((rotateButton() as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup({ activeAgentId: 'a', onRotateAgent: undefined });
    expect((rotateButton() ?? null)).toBeNull();
  });

  it('collapses only the side and keeps the rail', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    expect(screen.queryByRole('complementary', { name: 'Navegação principal' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Espaços' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir barra lateral' }));
    expect(screen.getByRole('complementary', { name: 'Navegação principal' })).toBeTruthy();
  });

  it('starts a plain new chat from the agent space header', () => {
    const { props } = setup({ activeAgentId: 'a' });
    const icon = screen.getAllByRole('button', { name: 'Nova conversa' }).find((b) => b.textContent === '')!;
    fireEvent.click(icon);
    expect(props.onNew).toHaveBeenCalledOnce();
    expect(props.onRotateAgent).not.toHaveBeenCalled();
  });

  it('shows the Equipe pending badge with the same count as the phone', () => {
    setup({ agents: [view('a', { state: 'waiting' }), view('b')] });
    expect(screen.getByRole('button', { name: /Equipe/ }).textContent).toContain('1');
  });

  it('mod+/ in an agent space switches to all conversations and focuses the search', async () => {
    const { props } = setup({ activeAgentId: 'a' });
    const focused = vi.fn();
    window.addEventListener('deck:focus-session-search', focused);
    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(screen.getByText('lista de conversas')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 10));
    expect(focused).toHaveBeenCalledOnce();
    expect(props.nav).not.toHaveBeenCalled();
    window.removeEventListener('deck:focus-session-search', focused);
  });
});
