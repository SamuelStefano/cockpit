// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileDrawerShortcuts } from './MobileDrawerShortcuts';

afterEach(cleanup);

const view = (id: string, state = 'idle') => ({ bot: { id, name: id, mascot: 'bit' }, state }) as never;

describe('MobileDrawerShortcuts', () => {
  it('shows Equipe with the pending count, Agentes, Trabalho and Explorar to an admin', () => {
    render(<MobileDrawerShortcuts role="admin" views={[view('a', 'waiting'), view('b')]} onNavigate={vi.fn()} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1Equipe', 'Agentes', 'Trabalho', 'Explorar']);
  });

  it('navigates on tap, Trabalho going to the first work route of the role', () => {
    const onNavigate = vi.fn();
    render(<MobileDrawerShortcuts role="admin" views={[]} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Equipe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trabalho' }));
    expect(onNavigate.mock.calls).toEqual([['/equipe'], ['/canvas']]);
  });

  it('hides what the role cannot open', () => {
    render(<MobileDrawerShortcuts role="student" views={[]} onNavigate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Equipe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trabalho' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Explorar' })).toBeNull();
  });
});
