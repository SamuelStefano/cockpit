// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTopBar } from './MobileTopBar';

afterEach(cleanup);

describe('MobileTopBar', () => {
  it('shows a fixed title, the menu, the usage ring and the profile', () => {
    const onMenu = vi.fn();
    render(<MobileTopBar onMenu={onMenu} menuOpen={false} usage={{ planUsage: null, stats: null }} account={{}} conn="connected" role="admin" />);
    expect(screen.getByText('Deck')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Uso do plano/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeTruthy();
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(menu);
    expect(onMenu).toHaveBeenCalledOnce();
  });
});
