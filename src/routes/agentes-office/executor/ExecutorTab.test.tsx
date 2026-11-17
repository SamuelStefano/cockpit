// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ExecutorTab } from './ExecutorTab';
import { bots, executor, job } from './executor.fixtures';

afterEach(cleanup);

const props = { executor: executor(), jobs: [], bots, canEdit: true, onRun: vi.fn(), onCancel: vi.fn() };

describe('ExecutorTab status card', () => {
  it('shows label and online state', () => {
    render(<ExecutorTab {...props} />);
    const card = within(screen.getByRole('region', { name: 'Status do executor' }));
    expect(card.getByText('PC do Samuel')).toBeTruthy();
    expect(card.getByText('online')).toBeTruthy();
  });
  it('shows offline with the amber stall warning', () => {
    render(<ExecutorTab {...props} executor={executor({ online: false, stalledSince: Date.now() - 12 * 60_000 })} />);
    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Há 12 min esperando o executor ligar');
  });
  it('explains where the executor is configured when it is not', () => {
    render(<ExecutorTab {...props} executor={{ configured: false, label: '', online: null }} />);
    expect(screen.getByText('não configurado')).toBeTruthy();
    expect(screen.getByText(/~\/\.cockpit\/executor\.json/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ExecutorTab job list', () => {
  const jobs = [
    job({ id: 'old', createdAt: 1, status: 'done', exitCode: 0, command: 'npm run build', startedAt: 1_000, endedAt: 4_000, tail: 'built ok' }),
    job({ id: 'new', createdAt: 9, status: 'running', requestedBy: 'a1', startedAt: Date.now() - 5_000, command: 'x'.repeat(300) }),
  ];
  it('lists newest first with chip, repo@branch, requester and exit code', () => {
    render(<ExecutorTab {...props} jobs={jobs} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Rodando');
    expect(items[0].textContent).toContain('org/app@feat/x');
    expect(items[0].querySelector('svg[role="img"]')).toBeTruthy();
    expect(items[0].textContent).toContain('Ana');
    expect(items[1].textContent).toContain('você');
    expect(items[1].textContent).toContain('código 0');
    expect(items[1].textContent).toContain('3s');
  });
  it('expands to the log tail and the full command', () => {
    render(<ExecutorTab {...props} jobs={jobs} />);
    const [, doneRow] = screen.getAllByRole('listitem');
    expect(within(doneRow).queryByLabelText('Saída')).toBeNull();
    fireEvent.click(within(doneRow).getByRole('button', { name: /npm run build/ }));
    expect(within(doneRow).getByLabelText('Saída').textContent).toBe('built ok');
  });
  it('cancels queued and running jobs only, for admins only', () => {
    const onCancel = vi.fn();
    render(<ExecutorTab {...props} jobs={jobs} onCancel={onCancel} />);
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledWith('new');
    cleanup();
    render(<ExecutorTab {...props} jobs={jobs} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });
  it('says so when there are no jobs', () => {
    render(<ExecutorTab {...props} />);
    expect(screen.getByText(/Nenhum job ainda/)).toBeTruthy();
  });
});
