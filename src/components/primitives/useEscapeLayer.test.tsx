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
