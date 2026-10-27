// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu, MenuItem } from './Menu';
import { Avatar } from './Avatar';
import { RiskBadge } from './RiskBadge';

afterEach(cleanup);

describe('Menu', () => {
  it('focuses the first item and moves with the arrows', () => {
    const onPick = vi.fn();
    render(<Menu label="Ações"><MenuItem label="Um" onClick={onPick} /><MenuItem label="Dois" danger /></Menu>);
    const [one, two] = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(one);
    fireEvent.keyDown(one, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(two);
    fireEvent.click(one);
    expect(onPick).toHaveBeenCalledOnce();
  });
});

describe('Avatar', () => {
  it('shows initials', () => {
    render(<Avatar name="Samuel Stefano" />);
    expect(screen.getByRole('img', { name: 'Samuel Stefano' }).textContent).toBe('SS');
  });
});

describe('RiskBadge', () => {
  it('labels each risk', () => {
    render(<><RiskBadge risk="read" /><RiskBadge risk="write" /><RiskBadge risk="net" /></>);
    expect(['lê', 'escreve', 'rede'].every((t) => screen.getByText(t))).toBe(true);
  });
});
