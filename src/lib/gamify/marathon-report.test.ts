import { describe, it, expect } from 'vitest';
import { stepRuns, reportReady, fmtDuration, MARATHON_MIN_RUN_MS, MARATHON_IDLE_MS } from './marathon-report';

const set = (...ids: string[]) => new Set(ids);

describe('marathon run tracking', () => {
  it('starts on first run and counts each running-to-idle edge as a turn', () => {
    let runs = stepRuns({}, set('a'), set('a'), 1000);
    expect(runs.a).toMatchObject({ start: 1000, turns: 0, running: true });
    runs = stepRuns(runs, set('a'), set(), 5000);
    expect(runs.a).toMatchObject({ turns: 1, running: false, lastActive: 5000 });
    runs = stepRuns(runs, set('a'), set(), 9000);
    expect(runs.a.turns).toBe(1);
    expect(runs.a.start).toBe(1000);
  });

  it('forgets sessions that left the marathon', () => {
    const runs = stepRuns({}, set('a'), set('a'), 1);
    expect(stepRuns(runs, set(), set(), 2)).toEqual({});
  });
});

describe('reportReady', () => {
  const run = { start: 0, lastActive: MARATHON_MIN_RUN_MS + 1, turns: 5, running: false, dismissed: false };

  it('needs over an hour of running and over 10 minutes idle', () => {
    expect(reportReady(run, run.lastActive + MARATHON_IDLE_MS + 1)).toBe(true);
    expect(reportReady(run, run.lastActive + 1000)).toBe(false);
    expect(reportReady({ ...run, lastActive: 1000 }, 10 * MARATHON_IDLE_MS)).toBe(false);
  });

  it('stays hidden while running or after dismissal', () => {
    const late = run.lastActive + MARATHON_IDLE_MS + 1;
    expect(reportReady({ ...run, running: true }, late)).toBe(false);
    expect(reportReady({ ...run, dismissed: true }, late)).toBe(false);
    expect(reportReady(undefined, late)).toBe(false);
  });

  it('formats durations', () => {
    expect(fmtDuration(130 * 60_000)).toBe('2h 10min');
    expect(fmtDuration(20_000)).toBe('1min');
  });
});
