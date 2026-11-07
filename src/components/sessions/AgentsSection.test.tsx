// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { BotView } from '../../routes/equipe/team-view';
import { AgentsSection } from './AgentsSection';

afterEach(cleanup);

const view = (id: string, name: string, extra: Partial<BotView['bot']> = {}) => ({
  bot: { id, name, label: name, instructions: '', mascot: 'bit', profile: 'full', createdAt: 0, updatedAt: 0, ...extra },
  state: 'idle', unread: false, preview: '',
}) as unknown as BotView;

describe('AgentsSection', () => {
  it('renders nothing without agents', () => {
    const { container } = render(<AgentsSection views={[]} activeId={null} onOpen={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists agents and opens one on click', () => {
    const onOpen = vi.fn();
    render(<AgentsSection views={[view('a', 'capo', { primary: true }), view('b', 'growth')]} activeId="a" onOpen={onOpen} />);
    expect(screen.getByRole('region', { name: 'Agentes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'capo' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'growth' }));
    expect(onOpen).toHaveBeenCalledWith('b');
  });

  it('offers a new agent only when allowed', () => {
    const onNew = vi.fn();
    const { rerender } = render(<AgentsSection views={[view('a', 'capo')]} activeId={null} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Novo agente' })).toBeNull();
    rerender(<AgentsSection views={[view('a', 'capo')]} activeId={null} onOpen={() => {}} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo agente' }));
    expect(onNew).toHaveBeenCalled();
  });
});
