// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { savePref } from '../../lib/persist';
import { GAME_ENABLED_KEY } from '../../lib/prefs';
import { requestArcade } from '../../game/arcade-bus';
import { ArcadeButton } from './ArcadeButton';
import { RunnerHost } from './RunnerHost';

describe('ArcadeButton', () => {
  beforeEach(() => localStorage.clear());

  it('is one icon with no text, and opens a compact popover', () => {
    render(<ArcadeButton expanded />);
    const btn = screen.getByRole('button', { name: 'Arcade' });
    expect(btn.textContent).toBe('');
    fireEvent.click(btn);
    const dlg = screen.getByRole('dialog', { name: 'Arcade' });
    expect(dlg.textContent).toContain('Nv 1');
    expect(dlg.textContent).toContain('segredos');
    expect(dlg.textContent).toContain('Jogar');
  });

  it('closes on Esc', () => {
    render(<ArcadeButton expanded />);
    fireEvent.click(screen.getByRole('button', { name: 'Arcade' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Arcade' })).toBeNull();
  });

  it('opens from the arcade bus (palette command)', async () => {
    render(<ArcadeButton expanded={false} />);
    await act(async () => { requestArcade('popover'); });
    expect(screen.getByRole('dialog', { name: 'Arcade' })).toBeTruthy();
  });

  it('lists the secret commands with ??? for unfound ones and the typing hint', () => {
    render(<ArcadeButton expanded />);
    fireEvent.click(screen.getByRole('button', { name: 'Arcade' }));
    fireEvent.click(screen.getByRole('button', { name: /Comandos secretos/ }));
    expect(screen.getAllByText('???').length).toBe(8);
    expect(screen.getByText(/fora de campos de texto/)).toBeTruthy();
  });

  it('Jogar opens the runner modal', async () => {
    render(<><ArcadeButton expanded /><RunnerHost /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Arcade' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Jogar' })); });
    expect(screen.getByRole('dialog', { name: 'Bit Runner' })).toBeTruthy();
  });

  it('renders nothing when the game is off', () => {
    savePref(GAME_ENABLED_KEY, false);
    const { container } = render(<ArcadeButton expanded />);
    expect(container.innerHTML).toBe('');
  });
});
