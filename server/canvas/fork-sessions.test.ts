import { describe, expect, it, beforeEach } from 'vitest';
import { __resetForkSessions, bindForkSession, forkParentOf } from './fork-sessions';

beforeEach(() => __resetForkSessions());

describe('bindForkSession / forkParentOf', () => {
  it('returns undefined for an unbound session, and the parent after binding', () => {
    expect(forkParentOf('child-1')).toBeUndefined();
    bindForkSession('child-1', 'parent-1');
    expect(forkParentOf('child-1')).toBe('parent-1');
  });

  it('a later bind for the same child overwrites the earlier one', () => {
    bindForkSession('child-1', 'parent-1');
    bindForkSession('child-1', 'parent-2');
    expect(forkParentOf('child-1')).toBe('parent-2');
  });
});
