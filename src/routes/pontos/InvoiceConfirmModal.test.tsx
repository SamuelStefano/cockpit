// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DFL_STALE_MS } from '../../../shared/dfl-stale';

vi.mock('./pontosControls', () => ({
  usePontosControls: () => ({ selected: new Set(['d1']), clearSelected: vi.fn(), deselect: vi.fn(), excluded: new Set(), write: { onDflInvoice: vi.fn() } }),
}));

import { InvoiceConfirmModal } from './InvoiceConfirmModal';

afterEach(cleanup);

const projects = [{
  id: 'p1', name: 'P', points: 0, amountCents: 0,
  epics: [{ id: 'e1', name: 'E', status: 'active', points: 0, amountCents: 0, deliveries: [{
    id: 'd1', name: 'D', status: 'active', pricePerPoint: 75, points: 3, amountCents: 22500,
    tasks: [{ id: 't1', name: 'A', points: 3, status: 'open', rawStatus: 'done', amountCents: 22500 }],
  }] }],
}] as never;

describe('InvoiceConfirmModal with stale DFL data', () => {
  it('warns and disables the create button', () => {
    const { getByRole, getByText } = render(<InvoiceConfirmModal projects={projects} stale onClose={vi.fn()} />);
    expect(getByRole('alert').textContent).toContain('dados do DFL estão velhos');
    expect((getByText(/Criar/).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables it on fresh data', () => {
    const { queryByRole, getByText } = render(<InvoiceConfirmModal projects={projects} onClose={vi.fn()} />);
    expect(queryByRole('alert')).toBeNull();
    expect((getByText(/Criar/).closest('button') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('InvoiceConfirmModal with a snapshot the server still calls fresh', () => {
  it('blocks when syncedAt is older than the stale window', () => {
    const { getByRole } = render(<InvoiceConfirmModal projects={projects} syncedAt={Date.now() - 3 * 60 * 60 * 1000} onClose={vi.fn()} />);
    expect(getByRole('alert').textContent).toContain('dados do DFL estão velhos');
  });
});

describe('InvoiceConfirmModal when the snapshot ages while open', () => {
  it('shows the alert and disables the button on the click that finds it stale', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const { getByText, queryByRole, getByRole } = render(<InvoiceConfirmModal projects={projects} syncedAt={now - DFL_STALE_MS + 60_000} onClose={vi.fn()} />);
    expect(queryByRole('alert')).toBeNull();
    spy.mockReturnValue(now + 120_000);
    fireEvent.click(getByText(/Criar/));
    expect(getByRole('alert').textContent).toContain('dados do DFL estão velhos');
    expect((getByText(/Criar/).closest('button') as HTMLButtonElement).disabled).toBe(true);
    spy.mockRestore();
  });
});
