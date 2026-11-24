// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SessionGroupHeader } from './SessionGroupHeader';

afterEach(cleanup);

describe('SessionGroupHeader', () => {
  it('highlights "Aguardando você" in violet, without a count', () => {
    const { container } = render(<SessionGroupHeader label="Aguardando você" count={3} />);
    expect(screen.getByText('Aguardando você')).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
    expect(container.querySelector('.text-violet-300')).toBeTruthy();
  });

  it('inset mode drops the sticky positioning and negative margins', () => {
    const { container } = render(<SessionGroupHeader label="Aguardando você" inset />);
    const head = container.firstElementChild as HTMLElement;
    expect(head.className).not.toContain('sticky');
    expect(head.className).not.toContain('-mx-2');
  });

  it('plain group is sentence-case neutral text: no mono, no uppercase, no rule, no icon', () => {
    const { container } = render(<SessionGroupHeader label="Hoje" count={1} />);
    const head = container.firstElementChild as HTMLElement;
    expect(head.className).toContain('text-neutral-500');
    expect(head.className).toContain('text-[12px]');
    expect(head.className).not.toMatch(/font-mono|uppercase/);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.h-px')).toBeNull();
  });
});
