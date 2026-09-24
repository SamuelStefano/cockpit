// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CronTimeline } from './CronTimeline';

afterEach(cleanup);

describe('CronTimeline', () => {
  it('names the next runs in text, not only in hover titles', () => {
    const now = Date.UTC(2026, 8, 24, 12, 0);
    const slots = [
      { cronId: 'a', name: 'backup', at: now + 60 * 60_000, clash: false },
      { cronId: 'b', name: 'digest', at: now + 2 * 60 * 60_000, clash: false },
    ];
    const { getByText } = render(<CronTimeline slots={slots} now={now} />);
    expect(getByText(/próximos: backup .* · digest /)).toBeTruthy();
  });
});
