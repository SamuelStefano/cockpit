// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPref, setPref } from '../../../lib/persist';
import { WorkTabs } from './WorkTabs';

beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/canvas'); });
afterEach(cleanup);

describe('WorkTabs', () => {
  it('lists the tabs of the role and marks the active one', () => {
    render(<WorkTabs role="root" active="prs" />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Kanban', 'Canvas', 'PRs', 'Pontos']);
    expect(screen.getByRole('tab', { name: 'PRs' }).getAttribute('aria-selected')).toBe('true');
  });

  it('hides root-only tabs from an admin', () => {
    render(<WorkTabs role="admin" active="canvas" />);
    expect(screen.queryByRole('tab', { name: 'PRs' })).toBeNull();
  });

  it('navigates to the route of a tab', () => {
    render(<WorkTabs role="root" active="canvas" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pontos' }));
    expect(location.pathname).toBe('/pontos');
  });

  it('selects the board view for Kanban', () => {
    render(<WorkTabs role="root" active="canvas" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Kanban' }));
    expect(loadPref('canvas.mode', 'canvas')).toBe('kanban');
  });

  it.each(['kanban', 'chain'])('resets %s mode when Canvas is picked from any tab', (mode) => {
    localStorage.clear();
    setPref('canvas.mode', mode);
    render(<WorkTabs role="root" active="prs" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Canvas' }));
    expect(loadPref('canvas.mode', 'canvas')).toBe('canvas');
    expect(location.pathname).toBe('/canvas');
  });

  it('renders the actions slot', () => {
    render(<WorkTabs role="root" active="prs" actions={<button>Atualizar</button>} />);
    expect(screen.getByText('Atualizar')).toBeTruthy();
  });
});
