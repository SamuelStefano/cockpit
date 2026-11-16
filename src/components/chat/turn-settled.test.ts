import { describe, expect, it } from 'vitest';
import { showsWorking } from './turn-settled';

describe('showsWorking', () => {
  it('shows while a turn runs', () => {
    expect(showsWorking('thinking', false)).toBe(true);
    expect(showsWorking('streaming', undefined)).toBe(true);
  });
  it('hides once settled or idle', () => {
    expect(showsWorking('thinking', true)).toBe(false);
    expect(showsWorking('idle', false)).toBe(false);
  });
});
