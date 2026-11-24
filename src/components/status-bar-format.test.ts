import { describe, it, expect } from 'vitest';
import { fmtBytes, meterTone, vpsMeters } from './status-bar-format';
import type { SysStats } from '../../shared/protocol';

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

describe('vpsMeters', () => {
  const base = { cpu: 42, load: 1.5, mem: { used: 2 * 1024 ** 3, total: 4 * 1024 ** 3 }, disk: { used: 50 * 1024 ** 3, total: 100 * 1024 ** 3 } } as unknown as SysStats;

  it('lists cpu, ram and disk with percentages', () => {
    const m = vpsMeters(base);
    expect(m.map((x) => x.id)).toEqual(['cpu', 'ram', 'disk']);
    expect(m[1].pct).toBe(50);
    expect(m[2].detail).toBe('50.0G livre');
  });

  it('adds gpu and vram only when there is a gpu, and skips an empty disk', () => {
    const m = vpsMeters({ ...base, disk: undefined, gpu: { util: 30, memUsed: 1024 ** 3, memTotal: 4 * 1024 ** 3 } } as unknown as SysStats);
    expect(m.map((x) => x.id)).toEqual(['cpu', 'ram', 'gpu', 'vram']);
    expect(m[3].pct).toBe(25);
  });
});
