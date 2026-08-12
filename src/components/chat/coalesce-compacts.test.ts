import { describe, it, expect } from 'vitest';
import { coalesceCompacts } from './coalesce-compacts';
import type { Message, CompactMessage } from '../../data/mock';

const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const compact = (id: string, kind?: 'wakeup' | 'pr', extra?: Partial<CompactMessage>): CompactMessage =>
  ({ id, role: 'compact', kind, ...extra });

describe('coalesceCompacts', () => {
  it('passa mensagens normais intactas', () => {
    const msgs = [user('u1'), user('u2')];
    expect(coalesceCompacts(msgs)).toEqual(msgs);
  });

  it('não toca divisor isolado (sem count)', () => {
    const msgs = [user('u1'), compact('c1', 'wakeup'), user('u2')];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(3);
    expect((out[1] as CompactMessage).count).toBeUndefined();
  });

  it('colapsa run de wakeups consecutivos no último item com count', () => {
    const msgs = [user('u1'), compact('c1', 'wakeup'), compact('c2', 'wakeup'), compact('c3', 'wakeup'), user('u2')];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(3);
    const div = out[1] as CompactMessage;
    expect(div.id).toBe('c3');
    expect(div.count).toBe(3);
  });

  it('colapsa compactações sem kind separadas de wakeups', () => {
    const msgs = [compact('c1'), compact('c2'), compact('w1', 'wakeup'), compact('w2', 'wakeup')];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(2);
    expect((out[0] as CompactMessage).count).toBe(2);
    expect((out[0] as CompactMessage).kind).toBeUndefined();
    expect((out[1] as CompactMessage).count).toBe(2);
    expect((out[1] as CompactMessage).kind).toBe('wakeup');
  });

  it('junta run de PRs num divisor só, preservando cada link', () => {
    const msgs = [
      compact('p1', 'pr', { url: 'https://a', label: 'PR #1' }),
      compact('p2', 'pr', { url: 'https://b', label: 'PR #2' }),
    ];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(1);
    expect((out[0] as CompactMessage).prs).toEqual([
      { label: 'PR #1', url: 'https://a' },
      { label: 'PR #2', url: 'https://b' },
    ]);
  });

  it('PR isolada continua sem lista', () => {
    const out = coalesceCompacts([compact('p1', 'pr', { url: 'https://a' })]);
    expect((out[0] as CompactMessage).prs).toBeUndefined();
  });

  it('concatena listas de PR ao re-coalescer', () => {
    const msgs = [
      compact('p1', 'pr', { prs: [{ label: 'PR #1', url: 'https://a' }, { label: 'PR #2', url: 'https://b' }] }),
      compact('p3', 'pr', { url: 'https://c', label: 'PR #3' }),
    ];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(1);
    expect((out[0] as CompactMessage).prs).toHaveLength(3);
  });

  it('mensagem no meio quebra o run', () => {
    const msgs = [compact('c1', 'wakeup'), user('u1'), compact('c2', 'wakeup')];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(3);
    expect((out[0] as CompactMessage).count).toBeUndefined();
    expect((out[2] as CompactMessage).count).toBeUndefined();
  });

  it('soma counts pré-existentes ao re-coalescer', () => {
    const msgs = [compact('c1', 'wakeup', { count: 5 }), compact('c2', 'wakeup')];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(1);
    expect((out[0] as CompactMessage).count).toBe(6);
  });
});
