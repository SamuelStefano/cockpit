// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { savePref } from '../../lib/persist';
import { GAME_ENABLED_KEY } from '../../lib/prefs';
import { ArcadeButton } from './ArcadeButton';

describe('ArcadeButton', () => {
  beforeEach(() => localStorage.clear());

  it('is one icon with no text, and opens the Arcade screen', () => {
    const onOpen = vi.fn();
    render(<ArcadeButton expanded onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: 'Arcade' });
    expect(btn.textContent).toBe('');
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when the game is off', () => {
    savePref(GAME_ENABLED_KEY, false);
    const { container } = render(<ArcadeButton expanded onOpen={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
