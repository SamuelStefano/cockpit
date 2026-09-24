// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Trend, dayLabel } from './Trend';

afterEach(cleanup);

const DAY = 86_400_000;
const base = Date.UTC(2026, 8, 1, 3); // a Brasília midnight
const series = [
  { day: base, output: 1000, cost: 12.5 },
  { day: base + DAY, output: 0, cost: 0 },
  { day: base + 2 * DAY, output: 5000, cost: 40 },
];

describe('Trend', () => {
  it('tapping a bar shows that day in the header; tapping again goes back to the total', () => {
    render(<Trend series={series} />);
    const bar = screen.getByRole('button', { name: new RegExp(`^${dayLabel(base)} ·`) });
    fireEvent.click(bar);
    expect(bar.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/1k out|1\.0k out|1000 out/)).toBeTruthy();
    fireEvent.click(bar);
    expect(bar.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText(/ out$/)).toBeNull();
  });

  it('a day with no spend draws a 1px baseline, not the 4px floor of a small day', () => {
    render(<Trend series={series} />);
    const zero = screen.getByRole('button', { name: new RegExp(`^${dayLabel(base + DAY)} ·`) });
    const small = screen.getByRole('button', { name: new RegExp(`^${dayLabel(base)} ·`) });
    expect((zero.firstElementChild as HTMLElement).style.height).toBe('1px');
    expect(parseInt((small.firstElementChild as HTMLElement).style.height, 10)).toBeGreaterThanOrEqual(4);
  });
});
