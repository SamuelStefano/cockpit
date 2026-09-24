// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ComposerPlusMenu } from '../chat/ComposerPlusMenu';

afterEach(cleanup);

const mic = { listening: false, supported: true, toggle: vi.fn(), error: null } as never;

describe('useMenuKeys (composer + menu)', () => {
  it('focuses the first item on open and moves with the arrows, wrapping', () => {
    const { getByRole, getAllByRole } = render(<ComposerPlusMenu mic={mic} onAttach={vi.fn()} onPhoto={vi.fn()} />);
    fireEvent.click(getByRole('button', { name: 'Anexar, fotografar ou ditar' }));
    const items = getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowUp' });
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(getByRole('menu'), { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });
});
