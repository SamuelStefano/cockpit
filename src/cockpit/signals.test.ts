import { describe, it, expect } from 'vitest';
import { computeStalled, computeUpdated, STALL_MS } from './signals';
import type { Session } from '../data/mock';

const sess = (id: string, mtime: number): Session => ({
  id, title: id, relative: '', snippet: '', mtime, hasTerminal: false, active: false,
});

describe('computeStalled', () => {
  it('flags a running session with no frame past the threshold', () => {
    const now = 1_000_000;
    const out = computeStalled(['a', 'b'], { a: now - STALL_MS - 1, b: now - 1000 }, now);
    expect([...out]).toEqual(['a']);
  });

  it('treats a missing lastActivity as just-now (not stalled)', () => {
    const now = 1_000_000;
    expect(computeStalled(['a'], {}, now).size).toBe(0);
  });

  it('uses the exclusive boundary (exactly threshold is not stalled)', () => {
    const now = 1_000_000;
    expect(computeStalled(['a'], { a: now - STALL_MS }, now).size).toBe(0);
  });

  it('only considers sessions in the running set', () => {
    const now = 1_000_000;
    const out = computeStalled(['a'], { a: now - STALL_MS - 1, z: now - STALL_MS - 1 }, now);
    expect([...out]).toEqual(['a']);
  });
});

describe('computeUpdated', () => {
  const seen = { a: 10, b: 10, c: 10 };

  it('flags a non-active, non-running session whose mtime advanced past seen', () => {
    const out = computeUpdated([sess('a', 20)], seen, 'x', new Set());
    expect([...out]).toEqual(['a']);
  });

  it('excludes the active session', () => {
    expect(computeUpdated([sess('a', 20)], seen, 'a', new Set()).size).toBe(0);
  });

  it('excludes running sessions', () => {
    expect(computeUpdated([sess('a', 20)], seen, 'x', new Set(['a'])).size).toBe(0);
  });

  it('excludes never-seen sessions (no retroactive badge)', () => {
    expect(computeUpdated([sess('new', 20)], seen, 'x', new Set()).size).toBe(0);
  });

  it('excludes sessions whose mtime did not advance', () => {
    expect(computeUpdated([sess('a', 10)], seen, 'x', new Set()).size).toBe(0);
  });
});
