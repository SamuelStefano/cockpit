// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UsageRing, ringToneOf } from './UsageRing';

afterEach(cleanup);

describe('ringToneOf', () => {
  it.each([[null, 'idle'], [0, 'ok'], [69, 'ok'], [70, 'mid'], [89, 'mid'], [90, 'high'], [100, 'high']] as const)('%s -> %s', (v, t) => {
    expect(ringToneOf(v)).toBe(t);
  });
});

describe('UsageRing', () => {
  it('exposes the value to assistive tech without printing a number', () => {
    const { container } = render(<UsageRing value={48} label="Uso do plano" />);
    const m = screen.getByRole('meter', { name: 'Uso do plano' });
    expect(m.getAttribute('aria-valuenow')).toBe('48');
    expect(container.textContent).toBe('');
  });

  it('colors the arc by threshold and lets the tone override', () => {
    const { container, rerender } = render(<UsageRing value={95} />);
    expect(container.querySelectorAll('circle')[1].getAttribute('class')).toContain('stroke-red-500');
    rerender(<UsageRing value={95} tone="idle" />);
    expect(container.querySelectorAll('circle')[1].getAttribute('class')).toContain('stroke-neutral-600');
  });

  it('clamps out-of-range values', () => {
    const { container } = render(<UsageRing value={250} size={24} />);
    const arc = container.querySelectorAll('circle')[1];
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });
});
