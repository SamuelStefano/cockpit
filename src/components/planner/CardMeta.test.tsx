// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlannerTask } from '../../../shared/planner';
import { CardMeta } from './CardMeta';

const task = (o: Partial<PlannerTask> = {}): PlannerTask => ({
  id: 't1', title: 'Rename a helper', description: '', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1, ...o,
});

describe('CardMeta village badges', () => {
  it('shows pronta, quer-pronta and insegura', () => {
    const { rerender } = render(<CardMeta task={task({ ready: true, readyBy: 'human:b:d', readyAt: 1 })} />);
    expect(screen.getByText('pronta')).toBeTruthy();
    rerender(<CardMeta task={task({ wantReady: { by: 'luffy', reason: 'done', at: 1 } })} />);
    expect(screen.getByText('quer-pronta')).toBeTruthy();
    rerender(<CardMeta task={task({ title: 'Mexer na Produção' })} />);
    expect(screen.getByText('insegura')).toBeTruthy();
  });

  it('offers Marcar pronta only when a handler is given and the task is safe', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CardMeta task={task()} />);
    expect(screen.queryByText('Marcar pronta')).toBeNull();
    rerender(<CardMeta task={task()} onToggleReady={onToggle} />);
    fireEvent.click(screen.getByText('Marcar pronta'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<CardMeta task={task({ unsafe: true })} onToggleReady={onToggle} />);
    expect(screen.queryByText('Marcar pronta')).toBeNull();
  });
});
