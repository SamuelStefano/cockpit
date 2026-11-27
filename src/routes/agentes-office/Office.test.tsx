// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { BotView } from '../equipe/team-view';
import { Office } from './Office';

afterEach(cleanup);

const view = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle') => ({
  bot: { id, name: id, label: `cargo ${id}`, instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
}) as BotView;

const team = [
  view('lead', { department: 'engineering', primary: true }, 'working'),
  view('wk', { department: 'engineering', parentId: 'lead' }, 'waiting'),
  view('gro', { department: 'growth' }),
  view('free'),
];

describe('Office', () => {
  it('shows the real counts and one room per department', () => {
    render(<Office views={team} onOpen={() => {}} />);
    const chips = [...screen.getByRole('group', { name: 'Resumo' }).querySelectorAll('span')].map((e) => e.textContent);
    expect(chips).toEqual(['4agentes', '1trabalhando', '1esperando você']);
    ['Engenharia', 'Growth', 'Sem setor'].forEach((n) => expect(screen.getByRole('region', { name: n })).toBeTruthy());
  });

  it('puts the lead first with the chefe marker, and the state label on each desk', () => {
    render(<Office views={team} onOpen={() => {}} />);
    const room = within(screen.getByRole('region', { name: 'Engenharia' }));
    expect(room.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['lead', 'wk']);
    expect(room.getByText('chefe')).toBeTruthy();
    expect(room.getByText('trabalhando')).toBeTruthy();
    expect(room.getByText('esperando você')).toBeTruthy();
  });

  it('opens an agent on click', () => {
    const onOpen = vi.fn();
    render(<Office views={team} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'gro' }));
    expect(onOpen).toHaveBeenCalledWith('gro');
  });

  it('shows a calm empty state with the new-agent action', () => {
    const onNew = vi.fn();
    render(<Office views={[]} onOpen={() => {}} onNew={onNew} />);
    expect(screen.getByText('Nenhum agente ainda')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('shows no executor chip when it is absent or not configured', () => {
    render(<Office views={team} onOpen={() => {}} executor={{ configured: false, label: '', online: null }} />);
    expect(screen.queryByText(/online|offline/)).toBeNull();
  });

  it('shows the executor chip with the queue and opens the tab on click', () => {
    const onOpenExecutor = vi.fn();
    const jobs = [{ id: 'h1', repo: 'r', branch: 'b', command: 'c', requestedBy: 'human', status: 'queued' as const, tail: '', createdAt: 1 }];
    render(<Office views={team} onOpen={() => {}} executor={{ configured: true, label: 'PC', online: false }} heavyJobs={jobs} onOpenExecutor={onOpenExecutor} />);
    fireEvent.click(screen.getByRole('button', { name: 'PC offline · 1 na fila' }));
    expect(onOpenExecutor).toHaveBeenCalled();
  });
});
