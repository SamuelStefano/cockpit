// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamRail, TEAM_RAIL_PINNED_KEY, type TeamRailProps } from './TeamRail';
import type { BotView } from '../../routes/equipe/team-view';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const view = (id: string, over: Omit<Partial<BotView>, 'bot'> & { bot?: Record<string, unknown> } = {}): BotView => {
  const { bot, ...rest } = over;
  return { bot: { id, name: id.toUpperCase(), mascot: { shape: 'drop', color: '#22c55e' }, ...bot } as BotView['bot'], key: id, preview: '', unread: false, state: 'idle', ...rest };
};

function setup(views: BotView[], over: Partial<TeamRailProps> = {}) {
  const props: TeamRailProps = { views, activeId: null, onOpen: vi.fn(), onNew: vi.fn(), onAll: vi.fn(), canManage: true, onPauseSet: vi.fn(), ...over };
  render(<TeamRail {...props} />);
  return props;
}

describe('TeamRail', () => {
  it('renders nothing with no agents', () => {
    const { container } = render(<TeamRail views={[]} activeId={null} onOpen={vi.fn()} onNew={vi.fn()} onAll={vi.fn()} canManage />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('aside')).toBeNull();
  });

  it('shows one agent with the add button but no pause', () => {
    const p = setup([view('capo', { bot: { primary: true } })]);
    fireEvent.click(screen.getByRole('button', { name: 'CAPO' }));
    expect(p.onOpen).toHaveBeenCalledWith('capo');
    expect(screen.queryByRole('button', { name: 'Pausar equipe' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(p.onNew).toHaveBeenCalledOnce();
  });

  it('orders chief, then lead, then workers, and pauses the team', () => {
    const p = setup([
      view('w1', { bot: { parentId: 'lead' } }), view('lead', { bot: { parentId: 'capo' } }), view('capo', { bot: { primary: true } }),
    ]);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')).filter((n) => ['CAPO', 'LEAD', 'W1'].includes(n ?? ''));
    expect(names).toEqual(['CAPO', 'LEAD', 'W1']);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar equipe' }));
    expect(p.onPauseSet).toHaveBeenCalledWith(true);
  });

  it('is read-only for students', () => {
    setup([view('a'), view('b')], { canManage: false });
    expect(screen.queryByRole('button', { name: 'Novo agente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pausar equipe' })).toBeNull();
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy();
  });

  it('expands on hover with the living preview and a pending dot', () => {
    setup([view('a', { preview: 'Quer sua decisão', pending: { botId: 'a' } as never })]);
    expect(screen.queryByText('Quer sua decisão')).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('complementary').firstElementChild!);
    expect(screen.getByText('Quer sua decisão')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'esperando você' })).toBeTruthy();
  });

  it('persists the pin', () => {
    setup([view('a'), view('b')]);
    fireEvent.mouseEnter(screen.getByRole('complementary').firstElementChild!);
    fireEvent.click(screen.getByRole('button', { name: 'Fixar equipe' }));
    expect(localStorage.getItem(`cockpit:${TEAM_RAIL_PINNED_KEY}`)).toBe('true');
    cleanup();
    setup([view('a'), view('b')]);
    expect(screen.getByRole('button', { name: 'Soltar equipe' })).toBeTruthy();
  });
});
