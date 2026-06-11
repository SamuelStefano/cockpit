// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ConfirmArchive } from './ConfirmArchive';

afterEach(cleanup);

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmArchive title="Sessão X" onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
}

describe('ConfirmArchive (atalhos de teclado)', () => {
  it('Enter fora de campos confirma; Esc cancela', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Enter digitado num input/textarea NÃO confirma a ação destrutiva', () => {
    const { onConfirm } = setup();
    const input = document.createElement('input');
    const ta = document.createElement('textarea');
    document.body.append(input, ta);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
    input.remove(); ta.remove();
  });

  it('evento já consumido (defaultPrevented) é ignorado', () => {
    const { onConfirm, onCancel } = setup();
    const consume = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener('keydown', consume, { capture: true });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    window.removeEventListener('keydown', consume, { capture: true });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
