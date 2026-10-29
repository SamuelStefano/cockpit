import { describe, it, expect } from 'vitest';
import { bitStateFor } from './bit-state';

describe('bitStateFor allClear', () => {
  it('cheers once everything pending is done', () => {
    expect(bitStateFor({ conn: 'open', allClear: true })).toBe('happy');
  });

  it('never outranks a dead link or live work', () => {
    expect(bitStateFor({ conn: 'closed', allClear: true })).toBe('sleeping');
    expect(bitStateFor({ conn: 'open', running: true, allClear: true })).toBe('working');
  });
});
