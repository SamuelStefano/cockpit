// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawerNav } from './DrawerNav';

afterEach(cleanup);

describe('DrawerNav', () => {
  it('lists the expanded nav and opens the palette', () => {
    const nav = vi.fn();
    const onPalette = vi.fn();
    render(<DrawerNav route="/" nav={nav} role="admin" onPalette={onPalette} />);
    fireEvent.click(screen.getByRole('button', { name: 'skills' }));
    expect(nav).toHaveBeenCalledWith('/skills');
    fireEvent.click(screen.getByRole('button', { name: /^Comandos/ }));
    expect(onPalette).toHaveBeenCalledOnce();
  });
});
