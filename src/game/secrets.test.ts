import { describe, it, expect } from 'vitest';
import { secretRows, secretCount, SECRET_HOW } from './secrets';
import { EGG_IDS } from './eggs';

describe('secrets', () => {
  it('has instructions for every egg', () => {
    for (const id of EGG_IDS) expect(SECRET_HOW[id].length).toBeGreaterThan(3);
  });
  it('hides instructions of unfound eggs', () => {
    const rows = secretRows(['konami']);
    expect(rows.find((r) => r.id === 'konami')!.how).toBe(SECRET_HOW.konami);
    expect(rows.find((r) => r.id === 'matrix')!.how).toBe('???');
  });
  it('counts only known eggs', () => {
    expect(secretCount(['konami', 'matrix', 'bogus'])).toBe(2);
  });
});
