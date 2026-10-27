// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mascot } from './Mascot';
import { BOT_STATES } from './botState';

const mascot = { shape: 'drop' as const, color: '#22c55e' };

describe('Mascot', () => {
  it('names the bot and its state for screen readers', () => {
    render(<Mascot mascot={mascot} state="waiting" name="capo" />);
    expect(screen.getByRole('img', { name: 'capo: esperando você' })).toBeTruthy();
  });

  it('carries one motion class per state', () => {
    for (const state of BOT_STATES) {
      const { container, unmount } = render(<Mascot mascot={mascot} state={state} />);
      expect(container.querySelector('svg')!.classList.contains(`mascot-${state}`)).toBe(true);
      unmount();
    }
  });

  it('shows the dots only while working', () => {
    const { container, rerender } = render(<Mascot mascot={mascot} state="working" />);
    expect(container.querySelectorAll('.mascot-dots circle')).toHaveLength(3);
    rerender(<Mascot mascot={mascot} state="thinking" />);
    expect(container.querySelector('.mascot-dots')).toBeNull();
    expect(container.querySelector('.mascot-eyes')).toBeTruthy();
  });

  it('draws the expanding ring only while waiting', () => {
    const { container, rerender } = render(<Mascot mascot={mascot} state="waiting" />);
    expect(container.querySelector('.mascot-ring')).toBeTruthy();
    rerender(<Mascot mascot={mascot} state="idle" />);
    expect(container.querySelector('.mascot-ring')).toBeNull();
  });

  it('falls back to the blob for an unknown shape', () => {
    const { container } = render(<Mascot mascot={{ shape: 'cube' as never, color: '#fff000' }} />);
    expect(container.querySelector('path')!.getAttribute('fill')).toBe('#fff000');
  });
});
