// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

afterEach(cleanup);

describe('Avatar', () => {
  it('keeps the round amber default without a tone', () => {
    render(<Avatar name="Samuel Stefano" />);
    const el = screen.getByRole('img');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('from-amber-300');
    expect(el.textContent).toBe('SS');
    expect(el.querySelector('[data-status]')).toBeNull();
  });

  it('renders a rounded-square tinted avatar for a tone', () => {
    render(<Avatar name="Ana" tone="blue" />);
    const el = screen.getByRole('img');
    expect(el.className).toContain('rounded-[30%]');
    expect(el.className).toContain('bg-[#3b82f6]');
    expect(el.className).not.toContain('from-amber-300');
  });

  it.each(['ok', 'warn', 'err', 'idle'] as const)('shows the %s status dot', (status) => {
    render(<Avatar name="Ana" tone="green" status={status} />);
    expect(screen.getByRole('img').querySelector(`[data-status="${status}"]`)).not.toBeNull();
  });

  it('renders the image when src is given', () => {
    const { container } = render(<Avatar name="Ana" src="/a.png" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/a.png');
  });

  it('draws a glyph instead of the initials on a soft tint', () => {
    render(<Avatar name="Ana" tone="pink" glyph={<b>m</b>} />);
    const el = screen.getByRole('img');
    expect(el.textContent).toBe('m');
    expect(el.className).toContain('bg-[#ec4899]/20');
  });
});
