import { describe, it, expect } from 'vitest';
import { insertCompact } from './insert-compact';
import type { CompactMessage, Message } from '../data/types';

const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const asst = (id: string): Message => ({ id, role: 'assistant', blocks: [] });
const div = (id: string, kind?: 'wakeup' | 'pr'): CompactMessage => ({ id, role: 'compact', kind });

describe('insertCompact', () => {
  it('insere ANTES da bolha em voo', () => {
    const out = insertCompact([user('u1'), asst('a1')], div('c1'), 'a1');
    expect(out.map((m) => m.id)).toEqual(['u1', 'c1', 'a1']);
  });
  it('vai pro fim quando não há turno em voo', () => {
    const out = insertCompact([user('u1'), asst('a1')], div('c1'));
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1', 'c1']);
  });
  it('vai pro fim quando a bolha em voo não é a cauda', () => {
    const out = insertCompact([asst('a1'), user('u2')], div('c1'), 'a1');
    expect(out.map((m) => m.id)).toEqual(['a1', 'u2', 'c1']);
  });
  it('dedupe: ignora compactação seguida de outra no ponto de inserção', () => {
    const prev = [user('u1'), div('c1'), asst('a1')];
    expect(insertCompact(prev, div('c2'), 'a1')).toBe(prev);
  });
  it('dedupe não vale pros marcadores com kind', () => {
    const out = insertCompact([user('u1'), div('c1'), asst('a1')], div('c2', 'pr'), 'a1');
    expect(out.map((m) => m.id)).toEqual(['u1', 'c1', 'c2', 'a1']);
  });
});
