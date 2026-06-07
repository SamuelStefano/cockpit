import { describe, it, expect } from 'vitest';
import { parseCpu, parseMem, parseLoad, parseGpu, parseDisk } from './stats';

describe('parseCpu', () => {
  // /proc/stat: cpu  user nice system idle iowait irq softirq ...
  const line = (idle: number, busy: number) => `cpu  ${busy} 0 0 ${idle} 0 0 0\ncpu0 1 2 3 4`;

  it('returns 0 on the first tick (no previous sample) but captures the sample', () => {
    const r = parseCpu(line(100, 100), null);
    expect(r.cpu).toBe(0);
    expect(r.sample).toEqual({ total: 200, idle: 100 });
  });

  it('computes busy fraction from the delta between two samples', () => {
    const first = parseCpu(line(100, 100), null).sample;
    // next tick: idle +50, busy +50 → 50% of the 100-tick delta was busy
    const r = parseCpu(line(150, 150), first);
    expect(r.cpu).toBeCloseTo(50, 5);
  });

  it('counts iowait as idle (field 5), so iowait time is not "busy"', () => {
    const first = parseCpu('cpu  100 0 0 100 0 0 0', null).sample;
    // +100 iowait only, no busy → 0% used
    const r = parseCpu('cpu  100 0 0 100 100 0 0', first);
    expect(r.cpu).toBe(0);
  });

  it('clamps to 0 when the total delta is non-positive (counter reset/stall)', () => {
    const first = parseCpu(line(500, 500), null).sample;
    const r = parseCpu(line(100, 100), first); // totals went backwards
    expect(r.cpu).toBe(0);
    expect(r.sample).toEqual({ total: 200, idle: 100 });
  });

  it('returns 0 and keeps prev when there is no cpu line', () => {
    const prev = { total: 10, idle: 5 };
    const r = parseCpu('garbage\nno cpu here', prev);
    expect(r.cpu).toBe(0);
    expect(r.sample).toBe(prev);
  });

  it('never exceeds 100 even if idle goes backwards more than total', () => {
    const first = parseCpu('cpu  0 0 0 100 0 0 0', null).sample;
    const r = parseCpu('cpu  100 0 0 100 0 0 0', first); // all delta is busy
    expect(r.cpu).toBe(100);
  });
});

describe('parseMem', () => {
  it('computes used as MemTotal - MemAvailable in bytes', () => {
    const raw = 'MemTotal:       1000 kB\nMemFree:  100 kB\nMemAvailable:    400 kB\n';
    expect(parseMem(raw)).toEqual({ used: 600 * 1024, total: 1000 * 1024 });
  });

  it('clamps used to 0 if MemAvailable exceeds MemTotal', () => {
    const raw = 'MemTotal: 100 kB\nMemAvailable: 999 kB';
    expect(parseMem(raw)).toEqual({ used: 0, total: 100 * 1024 });
  });

  it('returns zeros when the fields are missing', () => {
    expect(parseMem('')).toEqual({ used: 0, total: 0 });
  });
});

describe('parseLoad', () => {
  it('reads the 1-minute load average (first field)', () => {
    expect(parseLoad('0.52 0.41 0.39 1/234 5678')).toBeCloseTo(0.52, 5);
  });

  it('returns 0 for unparseable input', () => {
    expect(parseLoad('')).toBe(0);
    expect(parseLoad('garbage')).toBe(0);
  });
});

describe('parseGpu', () => {
  const MiB = 1024 * 1024;

  it('parses util percent and converts MiB to bytes', () => {
    expect(parseGpu('42, 2048, 8192')).toEqual({ util: 42, memUsed: 2048 * MiB, memTotal: 8192 * MiB });
  });

  it('returns null when util is non-numeric (unexpected header)', () => {
    expect(parseGpu('utilization.gpu, memory.used, memory.total')).toBeNull();
  });

  it('uses only the first line for multi-GPU output', () => {
    expect(parseGpu('10, 1, 2\n99, 3, 4')?.util).toBe(10);
  });
});

describe('parseDisk', () => {
  it('computes used/total from block size and counts', () => {
    expect(parseDisk({ bsize: 4096, blocks: 1000, bfree: 250 })).toEqual({
      used: 750 * 4096,
      total: 1000 * 4096,
    });
  });

  it('accepts bigint fields (node statfs returns bigints on some platforms)', () => {
    expect(parseDisk({ bsize: 4096n, blocks: 1000n, bfree: 250n })).toEqual({
      used: 750 * 4096,
      total: 1000 * 4096,
    });
  });

  it('returns zeros when statfs failed (null)', () => {
    expect(parseDisk(null)).toEqual({ used: 0, total: 0 });
  });
});
