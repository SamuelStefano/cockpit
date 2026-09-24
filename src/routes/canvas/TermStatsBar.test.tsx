// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TermStatsBar } from './TermStatsBar';
import type { TermStats } from '../../../shared/canvas';

afterEach(cleanup);

const stats = (extra: Partial<TermStats> = {}): TermStats => ({ cpu: 10, rssMb: 100, procs: 2, ...extra });

describe('TermStatsBar — last-seen phrasing (canvas review item 6)', () => {
  it('a window touched under a minute ago never reads "parada há agora"', () => {
    const { container } = render(<TermStatsBar stats={stats({ lastAt: Date.now() - 1000 })} running={false} session />);
    expect(container.textContent).not.toMatch(/parada há agora/i);
    expect(container.textContent).toMatch(/parou agora/i);
  });

  it('a real elapsed amount reads "parada há X"', () => {
    const { container } = render(<TermStatsBar stats={stats({ lastAt: Date.now() - 7 * 60_000 })} running={false} session />);
    expect(container.textContent).toMatch(/parada há 7min/);
  });

  it('a running window shows the turn clock instead of the last-seen phrase', () => {
    const { container } = render(<TermStatsBar stats={stats({ turnStartedAt: Date.now() })} running session />);
    expect(container.textContent).not.toMatch(/parada há|parou agora/);
  });
});
