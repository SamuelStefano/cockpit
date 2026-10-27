// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover } from './Popover';

afterEach(cleanup);

function setup(open = true) {
  const onClose = vi.fn();
  render(
    <div>
      <Popover open={open} onClose={onClose} label="Menu" content={<button>dentro</button>}><button>gatilho</button></Popover>
      <button>fora</button>
    </div>,
  );
  return onClose;
}

describe('Popover', () => {
  it('renders nothing while closed', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the content when open', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
  });

  it('closes on an outside pointerdown but not on the trigger or the panel', () => {
    const onClose = setup();
    fireEvent.pointerDown(screen.getByText('dentro'));
    fireEvent.pointerDown(screen.getByText('gatilho'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const onClose = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
