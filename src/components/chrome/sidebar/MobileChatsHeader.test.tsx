// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileChatsHeader } from './MobileChatsHeader';

afterEach(cleanup);

const view = (id: string, state = 'idle', pending?: unknown) => ({ bot: { id, name: id, mascot: 'bit' }, state, pending }) as never;

describe('MobileChatsHeader', () => {
  it('lists Todos and every agent; tapping an agent opens it', () => {
    const onOpenAgent = vi.fn();
    render(<MobileChatsHeader views={[view('Capo'), view('Luna')]} onOpenAgent={onOpenAgent} onTeam={vi.fn()} />);
    expect(screen.getByText('Todos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Luna' }));
    expect(onOpenAgent).toHaveBeenCalledWith('Luna');
  });
  it('shows the requests line only when something waits, and it goes to Equipe', () => {
    const onTeam = vi.fn();
    const { rerender } = render(<MobileChatsHeader views={[view('Capo')]} onOpenAgent={vi.fn()} onTeam={onTeam} />);
    expect(screen.queryByText(/esperando você/)).toBeNull();
    rerender(<MobileChatsHeader views={[view('Capo', 'waiting')]} onOpenAgent={vi.fn()} onTeam={onTeam} />);
    fireEvent.click(screen.getByText('1 pedido esperando você'));
    expect(onTeam).toHaveBeenCalledOnce();
  });
});
