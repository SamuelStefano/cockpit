// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';
import { useDismiss } from '../chat/useDismiss';

afterEach(cleanup);

function Menu({ onMenuClose, onModalClose }: { onMenuClose: () => void; onModalClose: () => void }) {
  useDismiss(true, onMenuClose);
  return <Modal open onClose={onModalClose} title="Drop">conteúdo</Modal>;
}

describe('Escape layers', () => {
  it('closes only the modal, not the menu that opened it', () => {
    const onMenuClose = vi.fn();
    const onModalClose = vi.fn();
    render(<Menu onMenuClose={onMenuClose} onModalClose={onModalClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onModalClose).toHaveBeenCalledOnce();
    expect(onMenuClose).not.toHaveBeenCalled();
  });

  it('closes only the top of two stacked modals', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<><Modal open onClose={outer} title="a">a</Modal><Modal open onClose={inner} title="b">b</Modal></>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('Escape layers — confirm dialogs over a modal', () => {
  it('an AdminConfirm opened over a Modal closes first', async () => {
    const { AdminConfirm } = await import('../../routes/AdminConfirm');
    const modalClose = vi.fn();
    const cancel = vi.fn();
    render(<><Modal open onClose={modalClose} title="m">m</Modal><AdminConfirm heading="Remover?" body="x" cta="Remover" onConfirm={vi.fn()} onCancel={cancel} /></>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(modalClose).not.toHaveBeenCalled();
  });
});

describe('Escape layers — inner handlers win', () => {
  it('an input inside the modal that handles Escape keeps the modal open', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <Modal open onClose={onClose} title="m"><input aria-label="nome" onKeyDown={(e) => { if (e.key === 'Escape') e.preventDefault(); }} /></Modal>,
    );
    fireEvent.keyDown(getByRole('textbox'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
