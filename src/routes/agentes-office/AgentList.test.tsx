// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BotView } from '../equipe/team-view';
import { AgentList } from './AgentList';

afterEach(cleanup);

const view = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle') => ({
  bot: { id, name: id, label: `cargo ${id}`, instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
}) as BotView;

const team = [view('lead', { department: 'engineering' }, 'working'), view('gro', { department: 'growth' }, 'waiting'), view('free', {}, 'error')];

describe('AgentList', () => {
  it('shows counts, one row per agent and the state label', () => {
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} />);
    expect(screen.getByText('3 agentes')).toBeTruthy();
    expect(screen.getByText('1 trabalhando')).toBeTruthy();
    expect(screen.getByText('1 esperando você')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('parou com erro')).toBeTruthy();
  });

  it('opens chat and workspace from the row buttons', () => {
    const onChat = vi.fn();
    const onWorkspace = vi.fn();
    render(<AgentList views={team} onChat={onChat} onWorkspace={onWorkspace} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat com gro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workspace de gro' }));
    expect(onChat).toHaveBeenCalledWith('gro');
    expect(onWorkspace).toHaveBeenCalledWith('gro');
  });

  it('filters by sector chip', () => {
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Growth' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sem setor' }));
    expect(screen.getByRole('button', { name: 'Chat com free' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('has the new-agent action', () => {
    const onNew = vi.fn();
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(onNew).toHaveBeenCalled();
  });
});
