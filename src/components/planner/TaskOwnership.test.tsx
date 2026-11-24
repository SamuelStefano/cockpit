// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlannerTask } from '../../../shared/planner';
import type { TeamBot } from '../../../shared/protocol';
import { CardMeta } from './CardMeta';
import { TaskHandoffsView } from './TaskHandoffsView';
import { TaskOwnerField } from './TaskOwnerField';

const bot = (id: string, name: string, department?: TeamBot['department']): TeamBot => ({
  id, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0, ...(department ? { department } : {}),
});
const bots = [bot('a', 'Ana', 'growth'), bot('b', 'Beto', 'engineering'), bot('c', 'Caio')];
const task: PlannerTask = { id: 't', title: 'T', description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0 };

describe('CardMeta owner', () => {
  it('shows the owner mascot named after the bot', () => {
    render(<CardMeta task={{ ...task, ownerBotId: 'b' }} bots={bots} />);
    expect(screen.getByLabelText('Dono: Beto')).toBeTruthy();
  });
  it('renders nothing for an unknown owner on an otherwise bare task', () => {
    const { container } = render(<CardMeta task={{ ...task, ownerBotId: 'zz' }} bots={bots} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('TaskOwnerField', () => {
  it('lists no-owner plus bots grouped by department and reports the choice', () => {
    const onChange = vi.fn();
    render(<TaskOwnerField bots={bots} value={undefined} onChange={onChange} />);
    const select = screen.getByLabelText('Dono') as HTMLSelectElement;
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Engenharia', 'Growth', 'Sem setor']);
    fireEvent.change(select, { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledWith('a');
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe('TaskHandoffsView', () => {
  const h = (at: number, from: string, to: string) => ({ at, fromBotId: from, toBotId: to, done: 'd', pending: 'p', reason: 'r', switchPoint: 's' });
  it('renders newest first with the labelled note', () => {
    render(<TaskHandoffsView handoffs={[h(1, 'a', 'b'), h(2, 'b', 'c')]} bots={bots} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Beto passou para Caio');
    expect(items[1].textContent).toContain('Ana passou para Beto');
    expect(items[0].textContent).toContain('Ponto da troca: s');
  });
  it('renders nothing without history', () => {
    const { container } = render(<TaskHandoffsView handoffs={undefined} bots={bots} />);
    expect(container.firstChild).toBeNull();
  });
});
