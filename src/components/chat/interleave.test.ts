import { describe, it, expect } from 'vitest';
import { interleaveByTime } from './interleave';

const label = (rows: ReturnType<typeof interleaveByTime<{ id: string; ts?: number }, string>>) =>
  rows.map((r) => (r.kind === 'msg' ? r.msg.id : `[${r.node}]`));

describe('interleaveByTime', () => {
  it('places each extra before the first later message', () => {
    const rows = interleaveByTime([{ id: 'a', ts: 10 }, { id: 'b', ts: 20 }, { id: 'c', ts: 30 }], [
      { key: 'y', ts: 25, node: 'y' }, { key: 'x', ts: 15, node: 'x' },
    ]);
    expect(label(rows)).toEqual(['a', '[x]', 'b', '[y]', 'c']);
  });

  it('closes the thread with extras newer than every message', () => {
    expect(label(interleaveByTime([{ id: 'a', ts: 10 }], [{ key: 'x', ts: 99, node: 'x' }]))).toEqual(['a', '[x]']);
  });

  it('does not move an extra ahead of an untimed message, and keeps message indexes', () => {
    const rows = interleaveByTime([{ id: 'a', ts: 10 }, { id: 'opt' }, { id: 'b', ts: 30 }], [{ key: 'x', ts: 20, node: 'x' }]);
    expect(label(rows)).toEqual(['a', 'opt', '[x]', 'b']);
    expect(rows.filter((r) => r.kind === 'msg').map((r) => (r.kind === 'msg' ? r.index : -1))).toEqual([0, 1, 2]);
  });

  it('renders only the extras when the thread is empty', () => {
    expect(label(interleaveByTime([], [{ key: 'x', ts: 1, node: 'x' }]))).toEqual(['[x]']);
  });
});
