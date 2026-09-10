import { describe, it, expect } from 'vitest';
import { rowStatus } from './row-status';

const base = { relative: 'há 3m', now: 100_000 };

describe('rowStatus', () => {
  it('running shows elapsed time in green', () => {
    expect(rowStatus({ ...base, running: true, runStart: 100_000 - 75_000 })).toEqual(
      expect.objectContaining({ tone: 'green', text: 'trabalhando · 1m 15s' }),
    );
  });

  it('running without a start stamp still says trabalhando', () => {
    expect(rowStatus({ ...base, running: true })?.text).toBe('trabalhando');
  });

  it('stalled beats running', () => {
    expect(rowStatus({ ...base, running: true, stalled: true, runStart: 100_000 - 5_000 })).toEqual(
      expect.objectContaining({ tone: 'amber', text: 'sem resposta · 5s' }),
    );
  });

  it('waiting keeps the relative time next to the label', () => {
    expect(rowStatus({ ...base, waiting: true })).toEqual(expect.objectContaining({ tone: 'violet', text: 'aguarda você · há 3m' }));
  });

  it('running beats waiting (the turn moved on)', () => {
    expect(rowStatus({ ...base, running: true, waiting: true })?.tone).toBe('green');
  });

  it('idle session has no status', () => {
    expect(rowStatus(base)).toBeNull();
  });
});
