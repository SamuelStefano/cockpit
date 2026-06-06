import { describe, it, expect } from 'vitest';
import { fmtBytes, meterTone } from './statusBar.format';

describe('fmtBytes', () => {
  it('returns "0" for zero', () => {
    expect(fmtBytes(0)).toBe('0');
  });

  it('formats sub-gigabyte values as rounded megabytes', () => {
    expect(fmtBytes(512 * 1024 ** 2)).toBe('512M');
    expect(fmtBytes(1.5 * 1024 ** 2)).toBe('2M');
  });

  it('formats gigabyte-and-up with one decimal', () => {
    expect(fmtBytes(1024 ** 3)).toBe('1.0G');
    expect(fmtBytes(2.5 * 1024 ** 3)).toBe('2.5G');
  });
});

describe('meterTone', () => {
  it('returns the ok tone below 70%', () => {
    expect(meterTone(0)).toBe('var(--ok)');
    expect(meterTone(69)).toBe('var(--ok)');
  });

  it('returns the warn tone from 70% to under 90%', () => {
    expect(meterTone(70)).toBe('var(--warn)');
    expect(meterTone(89)).toBe('var(--warn)');
  });

  it('returns the error tone at 90% and above', () => {
    expect(meterTone(90)).toBe('var(--err)');
    expect(meterTone(100)).toBe('var(--err)');
  });
});
