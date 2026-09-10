import { describe, it, expect } from 'vitest';
import { fmtClock, fmtLast } from './cron-format';

const at = (iso: string) => new Date(iso).getTime();

describe('cron-format (Brasília)', () => {
  it('shows a same-day run as "hoje HH:MM" in Brasília time', () => {
    expect(fmtClock(at('2026-09-10T10:00:00Z'), at('2026-09-10T12:00:00Z'))).toBe('hoje 07:00');
  });

  it('keeps 23:30 BRT on the Brasília day even though UTC has rolled over', () => {
    expect(fmtClock(at('2026-09-11T02:30:00Z'), at('2026-09-10T12:00:00Z'))).toBe('hoje 23:30');
  });

  it('shows the date for another day', () => {
    expect(fmtClock(at('2026-09-11T10:00:00Z'), at('2026-09-10T12:00:00Z'))).toBe('11/09 07:00');
  });

  it('formats the last run in Brasília time', () => {
    expect(fmtLast(undefined)).toBe('nunca rodou');
    expect(fmtLast(at('2026-09-10T10:00:00Z'))).toBe('último: 10/09/2026 07:00');
  });
});
