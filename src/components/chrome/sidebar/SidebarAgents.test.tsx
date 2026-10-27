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
  it('is a single "Criar agente" row with no agents', () => {
    const p = setup([]);
    expect(screen.queryByText('Agentes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Criar agente' }));
    expect(p.onNew).toHaveBeenCalledOnce();
  });

  it('is one compact row with a single agent, still able to add another', () => {
    const p = setup([view('capo1')]);
    expect(screen.queryByText('Agentes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'CAPO1' }));
    expect(p.onOpen).toHaveBeenCalledWith('capo1');
    fireEvent.click(screen.getByRole('button', { name: 'Novo bot' }));
    expect(p.onNew).toHaveBeenCalledOnce();
  });

  it('lists several agents under a header, marking the open one and the dots', () => {
    setup([view('capo1'), view('ana22', { unread: true }), view('bia33', { pending: { botId: 'bia33' } as never })], true, { activeId: 'capo1' });
    expect(screen.getByRole('region', { name: 'Agentes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CAPO1' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('img', { name: 'mensagem nova' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'esperando você' })).toBeTruthy();
  });

  it('offers to pause the team only when it can', () => {
    const onPauseSet = vi.fn();
    setup([view('capo1'), view('ana22')], true, { onPauseSet });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar equipe' }));
    expect(onPauseSet).toHaveBeenCalledWith(true);
    cleanup();
    setup([view('capo1'), view('ana22')]);
    expect(screen.queryByRole('button', { name: 'Pausar equipe' })).toBeNull();
  });

  it('shows at most five mascots in the rail and nothing with no agents', () => {
    setup(['a', 'b', 'c', 'd', 'e', 'f'].map((c) => view(`${c}0001`)), false);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    cleanup();
    const { container } = render(<SidebarAgents views={[]} activeId={null} onOpen={vi.fn()} onNew={vi.fn()} expanded={false} />);
    expect(container.textContent).toBe('');
  });
});
