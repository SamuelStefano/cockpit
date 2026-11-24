// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

function mockMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

function setup(coarse: boolean) {
  mockMedia(coarse);
  const onClose = vi.fn();
  render(<Sheet open onClose={onClose} label="Escolher" content={<button>dentro</button>}><button>gatilho</button></Sheet>);
  return onClose;
}

describe('Sheet', () => {
  it('renders a bottom sheet with a scrim on touch', () => {
    const onClose = setup(true);
    expect(screen.getByRole('dialog', { name: 'Escolher' }).getAttribute('aria-modal')).toBe('true');
    fireEvent.pointerDown(screen.getByTestId('sheet-scrim'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape on touch', () => {
    const onClose = setup(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('falls back to a popover on desktop', () => {
    setup(false);
    expect(screen.queryByTestId('sheet-scrim')).toBeNull();
  });
});
