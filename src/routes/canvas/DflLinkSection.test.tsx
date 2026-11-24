// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DflLinkSection } from './DflLinkSection';

afterEach(cleanup);

const card = { id: 'c1', title: 'T', prompt: '', status: 'review', kind: 'task', contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1,
  dfl: { taskId: '11111111-1111-4111-8111-111111111111', awaitingConfirm: true } } as never;
const base = { card, isDflArea: true, snapshot: null, onLink: vi.fn(), onCreateLink: vi.fn(), onUnlink: vi.fn() };

describe('DflLinkSection confirmar sync', () => {
  it('sends once, then says it was sent', async () => {
    const onConfirmSync = vi.fn(async () => ({ ok: true }));
    const { getByText } = render(<DflLinkSection {...base} onConfirmSync={onConfirmSync} />);
    fireEvent.click(getByText('confirmar sync'));
    fireEvent.click(getByText('confirmar sync'));
    await waitFor(() => getByText(/enviado/));
    expect(onConfirmSync).toHaveBeenCalledOnce();
  });

  it('shows the error and lets you try again', async () => {
    const onConfirmSync = vi.fn(async () => ({ ok: false, message: 'escrita DFL só no loopback' }));
    const { getByText } = render(<DflLinkSection {...base} onConfirmSync={onConfirmSync} />);
    fireEvent.click(getByText('confirmar sync'));
    await waitFor(() => getByText('escrita DFL só no loopback'));
    expect((getByText('confirmar sync').closest('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
