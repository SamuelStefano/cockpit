// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mascot } from './Mascot';
import { MASCOT_STATES } from './mascot-state';

const mascot = { shape: 'drop' as const, color: '#22c55e' };

describe('Mascot', () => {
  it('names the bot and its state for screen readers', () => {
    render(<Mascot mascot={mascot} state="waiting" name="capo" />);
    expect(screen.getByRole('img', { name: 'capo: esperando você' })).toBeTruthy();
  });

  it('carries one motion class per state', () => {
    for (const state of MASCOT_STATES) {
      const { container, unmount } = render(<Mascot mascot={mascot} state={state} />);
      expect(container.querySelector('svg')!.classList.contains(`mascot-${state}`)).toBe(true);
      unmount();
    }
  });

  it('shows the dots only while thinking', () => {
    const { container, rerender } = render(<Mascot mascot={mascot} state="thinking" />);
    expect(container.querySelector('.mascot-dots')).toBeTruthy();
    rerender(<Mascot mascot={mascot} state="working" />);
    expect(container.querySelector('.mascot-dots')).toBeNull();
  });

  it('falls back to the blob for an unknown shape', () => {
    const { container } = render(<Mascot mascot={{ shape: 'cube' as never, color: '#fff000' }} />);
    expect(container.querySelector('path')!.getAttribute('fill')).toBe('#fff000');
  });
});
