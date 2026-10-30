// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { savePref, loadPref } from '../../lib/persist';
import { GAME_ENABLED_KEY, GAME_CRT_KEY } from '../../lib/prefs';
import { getGameState } from '../../game/game-bus';
import { KONAMI } from '../../game/eggs';
import { EggsHost } from './EggsHost';

const press = (keys: string[], target: Element | Document = document.body) => {
  for (const key of keys) fireEvent.keyDown(target, { key });
};

describe('EggsHost', () => {
  beforeEach(() => localStorage.clear());

  it('konami toggles CRT mode and records the egg', () => {
    const { container } = render(<EggsHost />);
    act(() => press(KONAMI));
    expect(container.querySelector('.arcade-crt')).not.toBeNull();
    expect(loadPref(GAME_CRT_KEY, false)).toBe(true);
    expect(getGameState().eggs).toContain('konami');
    act(() => press(KONAMI));
    expect(container.querySelector('.arcade-crt')).toBeNull();
  });

  it('ignores the codes typed into an input', () => {
    const { container } = render(<><input aria-label="x" /><EggsHost /></>);
    act(() => press([...'iddqd'], screen.getByLabelText('x')));
    expect(container.querySelector('.arcade-god')).toBeNull();
    expect(getGameState().eggs).toEqual([]);
  });

  it('iddqd turns on god mode and matrix opens the rain', () => {
    const { container } = render(<EggsHost />);
    act(() => press([...'iddqd']));
    act(() => { /* flush the deferred restart */ });
    expect(getGameState().eggs).toContain('iddqd');
    act(() => press([...'matrix']));
    expect(getGameState().eggs).toContain('matrix');
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('does nothing when the game is off', () => {
    savePref(GAME_ENABLED_KEY, false);
    const { container } = render(<EggsHost />);
    act(() => press(KONAMI));
    expect(container.innerHTML).toBe('');
    expect(getGameState().eggs).toEqual([]);
  });
});
