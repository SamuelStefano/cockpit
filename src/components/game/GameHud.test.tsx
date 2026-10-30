// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { savePref } from '../../lib/persist';
import { GAME_ENABLED_KEY } from '../../lib/prefs';
import { recordGameEvent } from '../../game/game-bus';
import { GameHud } from './GameHud';

describe('GameHud', () => {
  beforeEach(() => localStorage.clear());

  it('shows level and opens the arcade', () => {
    const open = vi.fn();
    render(<GameHud expanded onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Arcade: nível 1/ }));
    expect(open).toHaveBeenCalled();
    expect(screen.getByText('Nv 1')).toBeTruthy();
  });

  it('updates live after an event and shows the streak from day 2', () => {
    render(<GameHud expanded onOpen={() => {}} />);
    act(() => {
      recordGameEvent({ type: 'turn_done' }, new Date(2026, 9, 29, 12));
      recordGameEvent({ type: 'turn_done', key: 'b' }, new Date(2026, 9, 30, 12));
    });
    expect(screen.getByText('🔥2')).toBeTruthy();
  });

  it('renders the compact rail variant', () => {
    render(<GameHud expanded={false} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: /Arcade/ }).textContent).toContain('1');
  });

  it('renders nothing when the game is off', () => {
    savePref(GAME_ENABLED_KEY, false);
    const { container } = render(<GameHud expanded onOpen={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
