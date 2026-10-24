export interface TimedExtra<N> { key: string; ts: number; node: N }

export type ThreadRow<M, N> = { kind: 'msg'; msg: M; index: number } | { kind: 'extra'; key: string; node: N };

// Slots extra rows (a bot's bot↔bot traffic) into the thread by time: each extra
// goes right before the first message stamped after it. Messages without a
// timestamp (an optimistic bubble, a synthetic digest) never pull an extra
// ahead of them, and extras newer than every message close the thread.
export function interleaveByTime<M extends { ts?: number }, N>(msgs: M[], extras: TimedExtra<N>[]): ThreadRow<M, N>[] {
  const pending = [...extras].sort((a, b) => a.ts - b.ts);
  const rows: ThreadRow<M, N>[] = [];
  let next = 0;
  msgs.forEach((msg, index) => {
    if (typeof msg.ts === 'number') {
      while (next < pending.length && pending[next].ts < msg.ts) {
        const e = pending[next++];
        rows.push({ kind: 'extra', key: e.key, node: e.node });
      }
    }
    rows.push({ kind: 'msg', msg, index });
  });
  for (; next < pending.length; next++) rows.push({ kind: 'extra', key: pending[next].key, node: pending[next].node });
  return rows;
}
