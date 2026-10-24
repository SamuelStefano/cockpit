// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamRoster } from './TeamRoster';
import type { BotView } from './team-view';

const view = (id: string, primary = false): BotView => ({
  bot: { id, name: id, label: 'coo', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full', primary, createdAt: 0, updatedAt: 0 },
  key: id, preview: `oi de ${id}`, unread: !primary, state: 'idle',
});

describe('TeamRoster', () => {
  it('shows the empty state with a create button', () => {
    const onNew = vi.fn();
    render(<TeamRoster views={[]} loaded selectedId={null} onSelect={vi.fn()} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar bot' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('puts the primary in the big card and the rest in the list with unread dots', () => {
    const onSelect = vi.fn();
    render(<TeamRoster views={[view('capo', true), view('lead')]} loaded selectedId="capo" onSelect={onSelect} onNew={vi.fn()} />);
    expect(screen.getByLabelText('bot principal')).toBeTruthy();
    expect(screen.getByText('oi de lead')).toBeTruthy();
    expect(screen.getAllByLabelText('mensagem nova')).toHaveLength(1);
    fireEvent.click(screen.getByText('lead'));
    expect(onSelect).toHaveBeenCalledWith('lead');
  });
});
