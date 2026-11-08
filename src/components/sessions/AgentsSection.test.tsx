// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { BotView } from '../../routes/equipe/team-view';
import { AgentsSection } from './AgentsSection';

const renders = vi.hoisted(() => ({ roster: 0 }));
vi.mock('../team/TeamRoster', async (orig) => {
  const mod = await orig<typeof import('../team/TeamRoster')>();
  return { TeamRoster: (p: Parameters<typeof mod.TeamRoster>[0]) => { renders.roster++; return mod.TeamRoster(p); } };
});

afterEach(() => { cleanup(); localStorage.clear(); renders.roster = 0; });

const view = (id: string, name: string, extra: Partial<BotView['bot']> = {}) => ({
  bot: { id, name, label: name, instructions: '', mascot: 'bit', profile: 'full', createdAt: 0, updatedAt: 0, ...extra },
  state: 'idle', unread: false, preview: '',
}) as unknown as BotView;

describe('AgentsSection', () => {
  it('renders nothing without agents', () => {
    const { container } = render(<AgentsSection views={[]} activeId={null} onOpen={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  const expand = () => fireEvent.click(screen.getByRole('button', { name: 'Mostrar agentes' }));

  it('lists agents once expanded and opens one on click', () => {
    const onOpen = vi.fn();
    render(<AgentsSection views={[view('a', 'capo', { primary: true }), view('b', 'growth')]} activeId="a" onOpen={onOpen} />);
    expect(screen.getByRole('region', { name: 'Agentes' })).toBeTruthy();
    expand();
    expect(screen.getByRole('button', { name: 'capo' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'growth' }));
    expect(onOpen).toHaveBeenCalledWith('b');
  });

  it('offers a new agent only when allowed and expanded', () => {
    const onNew = vi.fn();
    const { rerender } = render(<AgentsSection views={[view('a', 'capo')]} activeId={null} onOpen={() => {}} />);
    expand();
    expect(screen.queryByRole('button', { name: 'Novo agente' })).toBeNull();
    rerender(<AgentsSection views={[view('a', 'capo')]} activeId={null} onOpen={() => {}} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(onNew).toHaveBeenCalled();
  });

  const team = () => [
    view('c', 'orchestrator', { primary: true }), view('l', 'grok-lead', { parentId: 'c' }),
    view('w1', 'grok-a', { parentId: 'l' }), view('w2', 'grok-b', { parentId: 'l' }),
  ];

  it('starts collapsed, showing only the open, working and unread agents', () => {
    const views = team();
    (views[2] as { state: string }).state = 'working';
    (views[3] as { unread: boolean }).unread = true;
    render(<AgentsSection views={views} activeId="c" onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Mostrar agentes' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'orchestrator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'grok-a' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'grok-b' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'grok-lead' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo agente' })).toBeNull();
  });

  it('shows no rows collapsed when nothing is open, working or unread', () => {
    render(<AgentsSection views={team()} activeId={null} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: 'orchestrator' })).toBeNull();
  });

  it('remembers the section expanded across mounts', () => {
    const { unmount } = render(<AgentsSection views={team()} activeId={null} onOpen={() => {}} />);
    expand();
    unmount();
    render(<AgentsSection views={team()} activeId={null} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Recolher agentes' })).toBeTruthy();
  });

  it.each([false, true])('folds workers under their lead once expanded (compact=%s)', (compact) => {
    render(<AgentsSection compact={compact} views={team()} activeId={null} onOpen={() => {}} />);
    expand();
    expect(screen.queryByRole('button', { name: 'grok-lead' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir orchestrator' }));
    expect(screen.getByRole('button', { name: 'grok-lead' }).textContent).toContain('+2');
    expect(screen.queryByRole('button', { name: 'grok-a' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir grok-lead' }));
    expect(screen.getByRole('button', { name: 'grok-b' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('cockpit:sidebar.agents.open') ?? '[]')).toEqual(expect.arrayContaining(['c', 'l']));
  });

  it('does not re-render the roster when the parent re-renders with the same props', () => {
    const views = team();
    const onOpen = () => {};
    const { rerender } = render(<AgentsSection compact views={views} activeId={null} onOpen={onOpen} />);
    const first = renders.roster;
    rerender(<AgentsSection compact views={views} activeId={null} onOpen={onOpen} />);
    expect(renders.roster).toBe(first);
  });
});
