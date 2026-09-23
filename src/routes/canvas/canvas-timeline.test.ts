import { describe, it, expect } from 'vitest';
import { aliveAt, ALIVE_PAD_MS, fmtTimelineStamp } from './canvas-timeline';

describe('aliveAt', () => {
  it('is alive strictly inside an activity interval', () => {
    expect(aliveAt({ activity: [[1000, 2000]] }, 1500)).toBe(true);
  });

  it('is alive just before/after an interval, within the pad', () => {
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 10_000 - ALIVE_PAD_MS)).toBe(true);
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 20_000 + ALIVE_PAD_MS)).toBe(true);
  });

  it('is not alive just past the pad', () => {
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 10_000 - ALIVE_PAD_MS - 1)).toBe(false);
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 20_000 + ALIVE_PAD_MS + 1)).toBe(false);
  });

  it('is not alive with no activity at all', () => {
    expect(aliveAt({}, 1500)).toBe(false);
    expect(aliveAt({ activity: [] }, 1500)).toBe(false);
  });

  it('checks every interval, not just the first', () => {
    expect(aliveAt({ activity: [[0, 100], [5000, 6000]] }, 5500)).toBe(true);
  });

  it('a running turn spans T once it starts, even with no activity recorded yet', () => {
    expect(aliveAt({}, 5000, 4000)).toBe(true);
    expect(aliveAt({}, 3000, 4000)).toBe(false); // T before the turn started
  });
});

describe('fmtTimelineStamp', () => {
  it('formats in BRT (UTC-3), independent of the runner\'s own timezone', () => {
    // 2026-09-23T15:00:00Z -> 12:00 in America/Sao_Paulo (UTC-3, no DST since 2019).
    expect(fmtTimelineStamp(Date.parse('2026-09-23T15:00:00Z'))).toBe('23/09, 12:00');
  });
});
