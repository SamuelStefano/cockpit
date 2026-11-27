import { describe, expect, it } from 'vitest';
import { requestNewOn, takeNewIntent } from './box-intent';

describe('box intent', () => {
  it('is taken once, only by the box it was asked for', () => {
    requestNewOn('a');
    expect(takeNewIntent('a')).toBe(true);
    expect(takeNewIntent('a')).toBe(false);
  });

  it('a remount on another box drops it', () => {
    requestNewOn('a');
    expect(takeNewIntent('b')).toBe(false);
    expect(takeNewIntent('a')).toBe(false);
  });
});
