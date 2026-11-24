// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { savePref } from '../../../lib/persist';
import { GAME_ENABLED_KEY, GAME_STATE_KEY } from '../../../lib/prefs';
import { emptyState, xpForLevel } from '../../../game/engine';
import { BaseProgress } from './BaseProgress';

const nav = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/route-nav', () => ({ navigateTo: nav }));

afterEach(() => { localStorage.clear(); nav.mockClear(); });

describe('BaseProgress', () => {
  it('shows the level from stored XP and opens the Arcade', () => {
    savePref(GAME_STATE_KEY, { ...emptyState(), xp: xpForLevel(3) + 1, streak: { current: 4, best: 4, lastDay: '2026-10-31' } });
    render(<BaseProgress />);
    expect(screen.getByText('Lv 3')).toBeTruthy();
    expect(screen.getByText('🔥4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(nav).toHaveBeenCalledWith('/arcade');
  });
  it('renders nothing when the game is off', () => {
    savePref(GAME_ENABLED_KEY, false);
    const { container } = render(<BaseProgress />);
    expect(container.firstChild).toBeNull();
  });
});
