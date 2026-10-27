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

  it('stacks agents, then conversations, then the routes', () => {
    render(
      <DrawerNav route="/" nav={vi.fn()} role="admin" onPalette={vi.fn()} sessions={<div>conversas</div>}
        agents={{ views: [], activeId: null, onOpen: vi.fn(), onNew: vi.fn() }} />,
    );
    const create = screen.getByRole('button', { name: 'Criar agente' });
    const list = screen.getByText('conversas');
    const skills = screen.getByRole('button', { name: 'skills' });
    expect(create.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(skills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
