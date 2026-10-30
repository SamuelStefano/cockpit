import { describe, it, expect } from 'vitest';
import { registerClick, PET_WINDOW_MS } from './logo-bit';

describe('registerClick', () => {
  it('pets on the third click inside the window and resets', () => {
    let r = registerClick([], 0);
    r = registerClick(r.times, 500);
    expect(r.pet).toBe(false);
    r = registerClick(r.times, 900);
    expect(r.pet).toBe(true);
    expect(r.times).toEqual([]);
  });
  it('forgets slow clicks', () => {
    let r = registerClick([], 0);
    r = registerClick(r.times, 1000);
    r = registerClick(r.times, PET_WINDOW_MS + 1500);
    expect(r.pet).toBe(false);
    expect(r.times.length).toBe(2);
  });
});
