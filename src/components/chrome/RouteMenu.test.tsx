// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { RouteMenu } from './RouteMenu';

afterEach(cleanup);

function Harness({ nav }: { nav: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  return <RouteMenu route={'/' as never} nav={nav as never} role="student" open={open} setOpen={setOpen} />;
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

  it('stays visible until the inline tab strip actually fits (per role)', () => {
    const root = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} role="root" open={false} setOpen={vi.fn()} />);
    expect(root.container.firstElementChild?.className).toContain('min-[1220px]:hidden');
    expect(root.container.firstElementChild?.className).not.toContain('md:hidden');
    cleanup();
    const admin = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} role="admin" open={false} setOpen={vi.fn()} />);
    expect(admin.container.firstElementChild?.className).toContain('min-[1160px]:hidden');
    cleanup();
    const fellow = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} role="student" open={false} setOpen={vi.fn()} />);
    expect(fellow.container.firstElementChild?.className).toContain('min-[1110px]:hidden');
  });

  it('lists pontos for root only and never the retired screens', () => {
    const labels = (role: 'root' | 'admin') => {
      const r = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} role={role} open setOpen={vi.fn()} />);
      const out = r.getAllByRole('menuitem').map((b) => b.textContent);
      cleanup();
      return out;
    };
    expect(labels('root')).toContain('pontos');
    expect(labels('root')).toContain('painel');
    expect(labels('admin')).not.toContain('pontos');
    expect(labels('admin')).toContain('painel');
    for (const gone of ['notas', 'playground', 'harness', 'admin']) expect(labels('root')).not.toContain(gone);
  });

  it('counts what waits on the user, on the trigger and on the route', () => {
    const r = render(<RouteMenu route={'/' as never} nav={vi.fn() as never} role="admin" open setOpen={vi.fn()} counts={{ '/equipe': 2 } as never} />);
    expect(r.getAllByTitle('2 esperando você')).toHaveLength(2);
    expect(r.getByRole('menuitem', { name: /equipe/ }).textContent).toContain('2');
  });
});
