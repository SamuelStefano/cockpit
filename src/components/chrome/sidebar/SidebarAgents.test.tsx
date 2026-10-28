// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarAgents } from './SidebarAgents';
import type { BotView } from '../../../routes/equipe/team-view';

afterEach(cleanup);

const view = (id: string, over: Partial<BotView> = {}): BotView => ({
  bot: { id, name: id.toUpperCase(), mascot: { shape: 'drop', color: '#22c55e' } } as BotView['bot'],
  key: id, preview: '', unread: false, state: 'idle', ...over,
});

function setup(views: BotView[], expanded = true, over = {}) {
  const props = { views, activeId: null, onOpen: vi.fn(), onNew: vi.fn(), expanded, ...over };
  render(<SidebarAgents {...props} />);
  return props;
}

describe('SidebarAgents', () => {
  it('renders nothing with no agents', () => {
    const { container } = render(<SidebarAgents views={[]} activeId={null} onOpen={vi.fn()} onNew={vi.fn()} expanded />);
    expect(container.textContent).toBe('');
  });

  it('shows the section with a single agent, its star and its live phrase', () => {
    const p = setup([view('capo1', { preview: 'Quer sua decisão', bot: { id: 'capo1', name: 'CAPO1', primary: true, mascot: { shape: 'drop', color: '#fff' } } as never })]);
    expect(screen.getByRole('region', { name: 'Agentes' })).toBeTruthy();
    expect(screen.getByText('Quer sua decisão')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'CAPO1' }));
    expect(p.onOpen).toHaveBeenCalledWith('capo1');
    fireEvent.click(screen.getByRole('button', { name: 'Novo bot' }));
    expect(p.onNew).toHaveBeenCalledOnce();
  });

  it('indents an agent by its depth in the hierarchy', () => {
    const mk = (id: string, parentId?: string) => view(id, { bot: { id, name: id.toUpperCase(), parentId, mascot: { shape: 'drop', color: '#fff' } } as never });
    setup([mk('capo1'), mk('lead2', 'capo1'), mk('ana33', 'lead2')]);
    expect(screen.getByRole('button', { name: 'CAPO1' }).style.marginLeft).toBe('');
    expect(screen.getByRole('button', { name: 'LEAD2' }).style.marginLeft).toBe('12px');
    expect(screen.getByRole('button', { name: 'ANA33' }).style.marginLeft).toBe('24px');
  });

  it('lists several agents under a header, marking the open one and the dots', () => {
    setup([view('capo1'), view('ana22', { unread: true }), view('bia33', { pending: { botId: 'bia33' } as never })], true, { activeId: 'capo1' });
    expect(screen.getByRole('region', { name: 'Agentes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CAPO1' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('img', { name: 'mensagem nova' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'esperando você' })).toBeTruthy();
  });

  it('no longer carries the pause switch, only the paused notice', () => {
    setup([view('capo1'), view('ana22')], true, { paused: true });
    expect(screen.queryByRole('button', { name: /equipe/ })).toBeNull();
    expect(screen.getByText('Mensagens entre agentes pausadas.')).toBeTruthy();
  });

  it('shows at most five mascots in the rail and nothing with no agents', () => {
    setup(['a', 'b', 'c', 'd', 'e', 'f'].map((c) => view(`${c}0001`)), false);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});
