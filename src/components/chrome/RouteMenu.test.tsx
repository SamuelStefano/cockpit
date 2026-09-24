// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { RouteMenu } from './RouteMenu';

afterEach(cleanup);

function Harness({ nav }: { nav: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  return <RouteMenu route={'/' as never} nav={nav as never} isAdmin={false} open={open} setOpen={setOpen} />;
}

describe('RouteMenu', () => {
  it('is a real menu: focus moves in, arrows move, Esc closes and returns focus', () => {
    const { getByRole, getAllByRole, queryByRole } = render(<Harness nav={vi.fn()} />);
    const trigger = getByRole('button', { name: /Trocar de rota/ });
    fireEvent.click(trigger);
    const items = getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    expect(items[0].getAttribute('aria-current')).toBe('page');
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(getByRole('menu'), { key: 'Escape' });
    expect(queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('stays visible until the inline tab strip actually fits (1360px for admin, 1110px otherwise)', () => {
    const admin = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} isAdmin open={false} setOpen={vi.fn()} />);
    expect(admin.container.firstElementChild?.className).toContain('min-[1360px]:hidden');
    expect(admin.container.firstElementChild?.className).not.toContain('md:hidden');
    cleanup();
    const fellow = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} isAdmin={false} open={false} setOpen={vi.fn()} />);
    expect(fellow.container.firstElementChild?.className).toContain('min-[1110px]:hidden');
  });
});
