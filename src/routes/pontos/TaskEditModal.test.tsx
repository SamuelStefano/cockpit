// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const ctl = vi.hoisted(() => ({ task: null as unknown, onDflChange: vi.fn(async () => ({ ok: true })) }));
vi.mock('./pontosControls', () => ({
  usePontosControls: () => ({ selectedTask: ctl.task, setSelectedTask: vi.fn(), write: { onDflChange: ctl.onDflChange } }),
}));

import { TaskEditModal } from './TaskEditModal';

afterEach(cleanup);

describe('TaskEditModal on a paid task', () => {
  it('needs the "fatura não muda" tick before saving new points', () => {
    ctl.task = { id: 't1', name: 'Relatório', points: 3, status: 'paid', rawStatus: 'done', amountCents: 22500 };
    const { getByText, getByRole, container } = render(<TaskEditModal />);
    fireEvent.change(container.querySelector('input')!, { target: { value: '5' } });
    const save = getByText('Salvar pontos').closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(getByRole('checkbox', { name: 'Entendi: a fatura existente não muda' }));
    expect(save.disabled).toBe(false);
  });

  it('does not ask for it on an open task', () => {
    ctl.task = { id: 't2', name: 'Export', points: 3, status: 'open', rawStatus: 'done', amountCents: 22500 };
    const { getByText, queryByRole, container } = render(<TaskEditModal />);
    fireEvent.change(container.querySelector('input')!, { target: { value: '5' } });
    expect((getByText('Salvar pontos').closest('button') as HTMLButtonElement).disabled).toBe(false);
    expect(queryByRole('checkbox')).toBeNull();
  });
});
