// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    expect(screen.getByText('3 agentes')).toBeTruthy();
    expect(screen.getByText('1 trabalhando')).toBeTruthy();
    expect(screen.getByText('1 esperando você')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('parou com erro')).toBeTruthy();
  });

  it('opens chat and workspace from the row buttons', () => {
    const onChat = vi.fn();
    const onWorkspace = vi.fn();
    const onProfile = vi.fn();
    render(<AgentList views={team} onChat={onChat} onWorkspace={onWorkspace} onProfile={onProfile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat com gro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workspace de gro' }));
    expect(onChat).toHaveBeenCalledWith('gro');
    expect(onWorkspace).toHaveBeenCalledWith('gro');
    expect(onProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Perfil de gro' }));
    expect(onProfile).toHaveBeenCalledWith('gro');
    expect(onWorkspace).toHaveBeenCalledTimes(1);
  });

  it('filters by sector chip', () => {
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Growth' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sem setor' }));
    expect(screen.getByRole('button', { name: 'Chat com free' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('has the new-agent action', () => {
    const onNew = vi.fn();
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('searches by name and shows the empty state with a clear action', () => {
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar agentes' }), { target: { value: 'gro' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar agentes' }), { target: { value: 'nada' } });
    expect(screen.getByText('Nenhum agente encontrado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('filters by status chip and by clicking the summary badges', () => {
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Com erro/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '1 esperando você' }));
    expect(screen.getByRole('button', { name: 'Chat com gro' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '1 trabalhando' }));
    expect(screen.getByRole('button', { name: 'Chat com lead' })).toBeTruthy();
  });

  it('duplicates through onSave and opens the copy profile once it arrives', () => {
    const onSave = vi.fn();
    const onProfile = vi.fn();
    const { rerender } = render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={onProfile} onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações de gro' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicar' }));
    const input = onSave.mock.calls[0][0];
    expect(input.name).toBe('gro-copia');
    expect(input.id).not.toBe('gro');
    expect(onProfile).not.toHaveBeenCalled();
    rerender(<AgentList views={[...team, view(input.id, { name: input.name })]} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={onProfile} onSave={onSave} onDelete={vi.fn()} />);
    expect(onProfile).toHaveBeenCalledWith(input.id);
  });

  it('asks for confirmation before deleting', () => {
    const onDelete = vi.fn();
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações de gro' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
    expect(onDelete).toHaveBeenCalledWith('gro');
  });

  it('hides row actions without save and delete callbacks', () => {
    render(<AgentList views={team} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Mais ações de gro' })).toBeNull();
  });
});
