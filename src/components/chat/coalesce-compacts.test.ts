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

  it('nunca colapsa divisores de PR (link distinto por item)', () => {
    const msgs = [compact('p1', 'pr', { url: 'https://a' }), compact('p2', 'pr', { url: 'https://b' })];
    const out = coalesceCompacts(msgs);
    expect(out).toHaveLength(2);
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
