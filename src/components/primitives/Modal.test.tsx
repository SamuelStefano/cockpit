// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from './Modal';
import { Drawer } from './Drawer';

afterEach(cleanup);

function Harness({ kind, autoFocusInput = false }: { kind: 'modal' | 'drawer'; autoFocusInput?: boolean }) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <input aria-label="field" autoFocus={autoFocusInput} />
      <button>last</button>
    </>
  );
  return (
    <>
      <button onClick={() => setOpen(true)}>trigger</button>
      {kind === 'modal'
        ? <Modal open={open} onClose={() => setOpen(false)} title="T">{body}</Modal>
        : <Drawer open={open} onClose={() => setOpen(false)} title="T">{body}</Drawer>}
    </>
  );
}

describe.each(['modal', 'drawer'] as const)('%s keyboard focus', (kind) => {
  it('moves focus in, keeps Tab inside and gives it back on close', () => {
    const { getByText, getByRole } = render(<Harness kind={kind} />);
    const trigger = getByText('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    getByText('last').focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(getByText('last'));
    fireEvent.click(getByRole('button', { name: 'Fechar' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus on content that focused itself, and still returns it to the trigger', () => {
    const { getByText, getByLabelText, getByRole } = render(<Harness kind={kind} autoFocusInput />);
    const trigger = getByText('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(getByLabelText('field'));
    fireEvent.click(getByRole('button', { name: 'Fechar' }));
    expect(document.activeElement).toBe(trigger);
  });
});
