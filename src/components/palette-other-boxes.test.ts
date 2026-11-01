import { describe, expect, it, vi } from 'vitest';
import type { SessionMeta } from '../../shared/protocol';
import { otherBoxCommands } from './palette-other-boxes';

const box = { id: 'b1', label: 'PC', online: true, lastSeen: null };
const s = { id: 's1', title: 'Rail' } as SessionMeta;

describe('otherBoxCommands', () => {
  it('stays out of the empty palette', () => {
    expect(otherBoxCommands(' ', [box], { b1: [s] }, vi.fn())).toEqual([]);
  });

  it('names the box and opens the session on it', () => {
    const open = vi.fn();
    const [cmd] = otherBoxCommands('ra', [box], { b1: [s] }, open);
    expect(cmd.hint).toBe('PC');
    cmd.run();
    expect(open).toHaveBeenCalledWith('b1', 's1');
  });

  it('caps a huge list', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ id: `s${i}`, title: 't' }) as SessionMeta);
    expect(otherBoxCommands('t', [box], { b1: many }, vi.fn())).toHaveLength(100);
  });
});
