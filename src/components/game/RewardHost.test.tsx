// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { showPill } from '../../game/pill-bus';
import { recordGameEvent } from '../../game/game-bus';
import { PILL_MS } from '../../game/useRewardQueue';
import { RewardHost } from './RewardHost';

describe('RewardHost', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('shows a one-line pill that clears itself after 3 s', () => {
    render(<RewardHost />);
    act(() => showPill({ icon: '📺', title: 'Modo CRT ligado' }));
    expect(screen.getByRole('status').textContent).toContain('Modo CRT ligado');
    act(() => { vi.advanceTimersByTime(PILL_MS + 10); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('turns an unlocked achievement into the same pill, name only', () => {
    render(<RewardHost />);
    act(() => recordGameEvent({ type: 'turn_done' }, new Date(2026, 9, 30, 12)));
    expect(screen.getByRole('status').textContent).toContain('Primeiro turno');
    expect(screen.getByRole('status').textContent).not.toContain('desbloqueada');
  });
});
