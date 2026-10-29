import { describe, it, expect } from 'vitest';
import { sidebarOrder } from './sidebar-order';
import type { Session } from '../data/types';

const NOW = new Date(2026, 9, 29, 12).getTime();
const s = (id: string, mtime: number, extra: Partial<Session> = {}) => ({ id, mtime, title: id, relative: '', snippet: '', ...extra }) as Session;

describe('sidebarOrder', () => {
  it('puts running first, then waiting, pinned, and recency', () => {
    const list = [s('old', NOW - 3 * 86_400_000), s('today', NOW - 1000), s('pin', NOW - 2 * 86_400_000), s('wait', NOW - 5000, { waiting: true }), s('run', NOW - 9000)];
    const ids = sidebarOrder(list, { pinned: new Set(['pin']), running: new Set(['run']), now: NOW }).map((x) => x.id);
    expect(ids).toEqual(['run', 'wait', 'pin', 'today', 'old']);
  });
});
