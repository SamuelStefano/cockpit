// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const ctl = vi.hoisted(() => ({
  deselect: vi.fn(), clearSelected: vi.fn(),
  onDflInvoice: vi.fn(async () => ({ ok: false, unknown: true, message: 'sem resposta a tempo — pode ter sido gravado' })),
}));
vi.mock('./pontosControls', () => ({
  usePontosControls: () => ({ selected: new Set(['d1']), clearSelected: ctl.clearSelected, deselect: ctl.deselect, excluded: new Set(), write: { onDflInvoice: ctl.onDflInvoice } }),
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

describe('InvoiceConfirmModal — reply timed out', () => {
  it('keeps the delivery listed with "confira no DFL" and does not deselect it', async () => {
    const onClose = vi.fn();
    const { getByText } = render(<InvoiceConfirmModal projects={projects} onClose={onClose} />);
    fireEvent.click(getByText(/Criar/).closest('button')!);
    await waitFor(() => getByText('confira no DFL'));
    expect(ctl.deselect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
