import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fake = vi.hoisted(() => ({
  pty: null as null | { cols: number; rows: number; resize: ReturnType<typeof vi.fn>; onData: () => void; onExit: () => void; write: () => void; kill: () => void },
  calls: [] as string[],
  emit: (_d: string) => {},
}));

vi.mock('node-pty', () => ({
  spawn: (_c: string, _a: string[], o: { cols: number; rows: number }) => {
    const pty = {
      cols: o.cols,
      rows: o.rows,
      resize: vi.fn((c: number, r: number) => { fake.calls.push(`resize ${c}x${r}`); pty.cols = c; pty.rows = r; }),
      onData: vi.fn((cb: (d: string) => void) => { fake.emit = cb; }),
      onExit: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
    };
    fake.pty = pty as never;
    return pty;
  },
}));

import { openTerm, closeTerm, syncPtySize, FIRST_REDRAW_MS } from './terminals';

describe('syncPtySize', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('resizes straight to the new size when it differs', () => {
    const pty = { cols: 80, rows: 24, resize: vi.fn() };
    syncPtySize(pty, 65, 38);
    expect(pty.resize).toHaveBeenCalledTimes(1);
    expect(pty.resize).toHaveBeenCalledWith(65, 38);
  });

  it('wobbles one row then restores when the size is unchanged', () => {
    const pty = { cols: 65, rows: 38, resize: vi.fn() };
    syncPtySize(pty, 65, 38);
    expect(pty.resize).toHaveBeenCalledTimes(1);
    expect(pty.resize).toHaveBeenLastCalledWith(65, 37);
    vi.runAllTimers();
    expect(pty.resize).toHaveBeenLastCalledWith(65, 38);
    expect(pty.resize).toHaveBeenCalledTimes(2);
  });

  it('does not wobble a one-row terminal', () => {
    const pty = { cols: 65, rows: 1, resize: vi.fn() };
    syncPtySize(pty, 65, 1);
    vi.runAllTimers();
    expect(pty.resize).not.toHaveBeenCalled();
  });
});

describe('openTerm on an existing pty', () => {
  const id = 'reattach-test';
  afterEach(() => { closeTerm(id); fake.calls.length = 0; });

  it('applies the new client size, after emitting the replay', () => {
    const noop = () => {};
    openTerm(id, 80, 24, noop, noop, noop);
    fake.emit('hello');
    fake.calls.length = 0;
    openTerm(id, 65, 38, noop, noop, () => fake.calls.push('replay'));
    expect(fake.calls).toEqual(['replay', 'resize 65x38']);
  });

  it('does not resize a freshly spawned pty (spawn already has the size)', () => {
    openTerm(id, 100, 30, () => {}, () => {}, () => {});
    expect(fake.calls).toEqual([]);
  });
});

describe('openTerm first prompt', () => {
  const id = 'first-prompt-test';
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { closeTerm(id); fake.calls.length = 0; vi.useRealTimers(); });

  it('spawns at the client size and forces one redraw once the pty settles', () => {
    openTerm(id, 100, 30, () => {}, () => {}, () => {});
    expect(fake.pty?.cols).toBe(100);
    expect(fake.pty?.rows).toBe(30);
    vi.advanceTimersByTime(FIRST_REDRAW_MS);
    expect(fake.calls).toEqual(['resize 100x29']);
    vi.runAllTimers();
    expect(fake.calls).toEqual(['resize 100x29', 'resize 100x30']);
  });

  it('replays output produced before a later attach', () => {
    const noop = () => {};
    openTerm(id, 80, 24, noop, noop, noop);
    fake.emit('deck@host:~$ ');
    const replay = vi.fn();
    openTerm(id, 80, 24, noop, noop, replay);
    expect(replay).toHaveBeenCalledWith('deck@host:~$ ');
  });
});
