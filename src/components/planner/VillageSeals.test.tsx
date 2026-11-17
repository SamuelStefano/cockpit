// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlannerTask } from '../../../shared/planner';
import { CardMeta } from './CardMeta';
import { ReadyPanel } from './ReadyPanel';

const task: PlannerTask = { id: 't', title: 'Ajustar cor', description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0, ownerBotId: 'a' };

describe('village seals on the card', () => {
  it('shows pronta, quer-pronta and insegura', () => {
    const { rerender } = render(<CardMeta task={{ ...task, ready: true, readyBy: 'human', readyAt: 1 }} />);
    expect(screen.getByText('pronta')).toBeTruthy();
    rerender(<CardMeta task={{ ...task, wantReady: { by: 'zoro', reason: 'small', at: 1 } }} />);
    expect(screen.getByText('quer-pronta')).toBeTruthy();
    rerender(<CardMeta task={{ ...task, title: 'Migração do banco' }} />);
    expect(screen.getByText('insegura')).toBeTruthy();
  });
});

describe('ReadyPanel', () => {
  it('marks ready through the dedicated callback', () => {
    const onReady = vi.fn();
    render(<ReadyPanel task={task} draft={task} onReady={onReady} />);
    fireEvent.click(screen.getByText('Marcar pronta'));
    expect(onReady).toHaveBeenCalledWith('t', true);
  });
  it('blocks an unsafe task, an unsaved draft and an ownerless task', () => {
    const { rerender } = render(<ReadyPanel task={{ ...task, title: 'Deploy em produção' }} draft={task} onReady={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Marcar pronta' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<ReadyPanel task={task} draft={{ ...task, title: 'outro' }} onReady={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Marcar pronta' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<ReadyPanel task={{ ...task, ownerBotId: undefined }} draft={{ ...task, ownerBotId: undefined }} onReady={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Marcar pronta' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
