// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeamTabs } from './TeamTabs';

beforeEach(() => history.replaceState(null, '', '/equipe'));
afterEach(cleanup);

describe('TeamTabs', () => {
  it('lists the tabs of the role and marks the active one', () => {
    render(<TeamTabs role="admin" active="rotinas" />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Pedidos', 'Rotinas', 'Memória', 'Mundo']);
    expect(screen.getByRole('tab', { name: /Rotinas/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders nothing for a student', () => {
    const { container } = render(<TeamTabs role="student" active="pedidos" />);
    expect(container.innerHTML).toBe('');
  });

  it('filters by the allow list', () => {
    render(<TeamTabs role="admin" active="rotinas" allow={['pedidos', 'rotinas']} />);
    expect(screen.queryByRole('tab', { name: /Memória/ })).toBeNull();
  });

  it('shows the pending count on Pedidos', () => {
    render(<TeamTabs role="admin" active="pedidos" counts={{ pedidos: 3 }} />);
    expect(screen.getByRole('tab', { name: /Pedidos/ }).textContent).toContain('3');
  });

  it('navigates to the route of a tab', () => {
    render(<TeamTabs role="admin" active="pedidos" />);
    fireEvent.click(screen.getByRole('tab', { name: /Mundo/ }));
    expect(location.pathname).toBe('/equipe/mundo');
  });

  it('renders the actions slot', () => {
    render(<TeamTabs role="admin" active="rotinas" actions={<button>Nova rotina</button>} />);
    expect(screen.getByText('Nova rotina')).toBeTruthy();
  });
});
