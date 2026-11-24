import { describe, expect, it } from 'vitest';
import { createRecorder, fmtDuration, renderReport, tail } from './report.mjs';

describe('fmtDuration', () => {
  it('formats ms, seconds and minutes', () => {
    expect(fmtDuration(420)).toBe('420ms');
    expect(fmtDuration(12_340)).toBe('12.3s');
    expect(fmtDuration(125_000)).toBe('2m05s');
  });
});

describe('renderReport', () => {
  it('lists every step and flags failures', () => {
    const md = renderReport({
      target: 'docker',
      startedAt: '2026-10-27T00:00:00Z',
      steps: [
        { name: 'a', ms: 1000, status: 'pass', screenshot: '01-a.png', detail: '' },
        { name: 'b', ms: 2000, status: 'fail', screenshot: null, detail: 'boom' },
      ],
      notes: ['n1'],
    });
    expect(md).toContain('Result: FAIL (1 failed)');
    expect(md).toContain('| a | 1.0s | pass | ![a](01-a.png) |');
    expect(md).toContain('boom');
    expect(md).toContain('- n1');
  });
});

describe('createRecorder', () => {
  it('marks a throwing step as failed and keeps going', async () => {
    const { step, steps } = createRecorder('/tmp');
    await step('ok', async () => 'fine');
    await step('bad', async () => { throw new Error('nope'); });
    expect(steps.map((s: { status: string }) => s.status)).toEqual(['pass', 'fail']);
    expect(steps[1].detail).toBe('nope');
  });
});

describe('tail', () => {
  it('keeps the last n lines', () => {
    expect(tail('1\n2\n3\n', 2)).toBe('2\n3');
  });
});
