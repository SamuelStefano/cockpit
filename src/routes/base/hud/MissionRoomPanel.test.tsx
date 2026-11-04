// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mission } from '../missions';
import { MissionRoomPanel } from './MissionRoomPanel';
import { MISSION_XP_KEY } from './missionXp';

const mk = (id: string, o: Partial<Mission> = {}): Mission => ({
  id, title: `T-${id}`, summary: `sum ${id}`, description: `full ${id}`, size: 'S', status: 'todo', xp: 10, suggested: false, reason: '', ...o,
});

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function setup(over: Partial<Parameters<typeof MissionRoomPanel>[0]> = {}) {
  const props = {
    missions: [mk('a', { suggested: true, reason: 'Quick win — smallest task on the board' }), mk('b', { size: 'M', xp: 25 })],
    open: true, onClose: vi.fn(), selectedId: null as string | null, onSelectMission: vi.fn(), onComplete: vi.fn(() => true), ...over,
  };
  return { props, ...render(<MissionRoomPanel {...props} />) };
}

describe('MissionRoomPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = setup({ open: false });
    expect(container.firstChild).toBeNull();
  });
  it('highlights the suggested mission with its reason', () => {
    setup();
    expect(screen.getByText('START HERE')).toBeTruthy();
    expect(screen.getByText('Quick win — smallest task on the board')).toBeTruthy();
    expect(screen.getByText('sum b')).toBeTruthy();
  });
  it('reports selection on click', () => {
    const { props } = setup();
    fireEvent.click(screen.getByText('T-b'));
    expect(props.onSelectMission).toHaveBeenCalledWith('b');
  });
  it('completing adds xp, persists it and plays the power-off ghost', () => {
    const { props } = setup({ selectedId: 'a' });
    expect(screen.getByText('full a')).toBeTruthy();
    fireEvent.click(screen.getByText('Complete mission'));
    expect(props.onComplete).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('mission-xp').textContent).toBe('10 XP');
    expect(localStorage.getItem(MISSION_XP_KEY)).toBe('10');
    expect(screen.getByText('+10 XP')).toBeTruthy();
    expect(props.onSelectMission).toHaveBeenCalledWith(null);
  });
  it('does not award xp when completion is refused', () => {
    setup({ selectedId: 'a', onComplete: vi.fn(() => false) });
    fireEvent.click(screen.getByText('Complete mission'));
    expect(screen.getByTestId('mission-xp').textContent).toBe('0 XP');
  });
  it('restores the stored xp total', () => {
    localStorage.setItem(MISSION_XP_KEY, '120');
    setup();
    expect(screen.getByTestId('mission-xp').textContent).toBe('120 XP');
  });
});
