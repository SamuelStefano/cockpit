import { describe, it, expect } from 'vitest';
import { firstRunSteps, firstRunDone, EMPTY_STEPS } from './first-run';

describe('first run steps', () => {
  it('starts with everything pending except what is already true', () => {
    const steps = firstRunSteps(true, EMPTY_STEPS, false);
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(firstRunDone(steps)).toBe(false);
  });

  it('counts an installed PWA as the install step', () => {
    expect(firstRunSteps(true, { conversation: true, install: false }, true).every((s) => s.done)).toBe(true);
  });

  it('is done only when all three are', () => {
    expect(firstRunDone(firstRunSteps(true, { conversation: true, install: true }, false))).toBe(true);
    expect(firstRunDone(firstRunSteps(false, { conversation: true, install: true }, false))).toBe(false);
  });
});
