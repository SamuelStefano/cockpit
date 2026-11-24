// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTopBar } from './MobileTopBar';

afterEach(cleanup);

describe('MobileTopBar', () => {
  it('shows the menu, the title and nothing of the usage ring or profile', () => {
    const onMenu = vi.fn();
    render(<MobileTopBar onMenu={onMenu} menuOpen={false} title="Skills" />);
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Uso do plano/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Perfil' })).toBeNull();
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(menu);
    expect(onMenu).toHaveBeenCalledOnce();
  });

  it('renders the single action when given', () => {
    render(<MobileTopBar onMenu={vi.fn()} menuOpen title="Uso" action={<button type="button">Atualizar</button>} />);
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeTruthy();
  });
});
