// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { AdminConfirm } from './AdminConfirm';

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      {open && <AdminConfirm heading="Remover token?" body="x" cta="Remover" onConfirm={vi.fn()} onCancel={() => setOpen(false)} />}
    </>
  );
}

describe('AdminConfirm focus', () => {
  it('focuses Cancelar on open, traps Tab, and returns focus when closed', () => {
    const { getByText } = render(<Harness />);
    const opener = getByText('abrir');
    opener.focus();
    fireEvent.click(opener);
    const cancel = getByText('Cancelar').closest('button')!;
    const confirm = getByText('Remover').closest('button')!;
    expect(document.activeElement).toBe(cancel);
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    expect(document.activeElement).toBe(opener);
  });
});
