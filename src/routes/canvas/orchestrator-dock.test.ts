import { describe, expect, it } from 'vitest';
import { clampDockWidth, isMobileWidth, MIN_DOCK_WIDTH, orchestratorRunning } from './orchestrator-dock';

describe('clampDockWidth', () => {
  it('floors at the minimum width', () => {
    expect(clampDockWidth(100, 1440)).toBe(MIN_DOCK_WIDTH);
  });

  it('caps at 60vw on a wide viewport', () => {
    expect(clampDockWidth(2000, 1440)).toBe(1440 * 0.6);
  });

  it('keeps a value already inside the range', () => {
    expect(clampDockWidth(500, 1440)).toBe(500);
  });

  it('still returns at least the minimum on a narrow viewport', () => {
    expect(clampDockWidth(200, 390)).toBe(MIN_DOCK_WIDTH);
  });
});

describe('isMobileWidth', () => {
  it('treats 390px as mobile', () => expect(isMobileWidth(390)).toBe(true));
  it('treats 1440px as desktop', () => expect(isMobileWidth(1440)).toBe(false));
  it('is exclusive-safe at the boundary', () => expect(isMobileWidth(480)).toBe(true));
});

describe('orchestratorRunning', () => {
  it('is false with no stats', () => expect(orchestratorRunning(undefined)).toBe(false));
  it('is false below the cpu threshold', () => expect(orchestratorRunning({ cpu: 0.4, rssMb: 10, procs: 1 })).toBe(false));
  it('is true at/above the cpu threshold', () => expect(orchestratorRunning({ cpu: 5, rssMb: 10, procs: 1 })).toBe(true));
});
