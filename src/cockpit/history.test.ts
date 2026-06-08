import { describe, it, expect } from 'vitest';
import { mergeHistory } from './history';
import type { Message } from '../../shared/protocol';

const u = (id: string, ts?: number): Message => ({ id, role: 'user', text: id, ts });

describe('mergeHistory (#165: bolha otimista some até o F5)', () => {
  it('thread local vazio: usa o snapshot cru', () => {
    expect(mergeHistory([u('a', 1)], [])).toEqual([u('a', 1)]);
  });

  it('preserva a bolha em voo ausente do snapshot e mais nova que ele', () => {
    const incoming = [u('a', 10), u('b', 20)];
    const local = [u('a', 10), u('b', 20), u('c', 30)]; // c = otimista não persistida
    expect(mergeHistory(incoming, local)).toEqual([u('a', 10), u('b', 20), u('c', 30)]);
  });

  it('snapshot que já inclui a bolha não duplica (dedup por id)', () => {
    const incoming = [u('a', 10), u('c', 30)];
    const local = [u('a', 10), u('c', 30)];
    expect(mergeHistory(incoming, local)).toEqual([u('a', 10), u('c', 30)]);
  });

  it('não ressuscita mensagem local antiga ausente do snapshot (apagada/editada)', () => {
    const incoming = [u('a', 10), u('b', 20)];
    const local = [u('old', 5), u('a', 10), u('b', 20)]; // old < lastTs e some do snapshot
    expect(mergeHistory(incoming, local)).toEqual([u('a', 10), u('b', 20)]);
  });

  it('snapshot vazio (full reload de sessão nova) mantém a bolha otimista', () => {
    const local = [u('c', 30)];
    expect(mergeHistory([], local)).toEqual([u('c', 30)]);
  });

  it('ignora local sem ts (legado) — só preserva o que é claramente em voo', () => {
    const incoming = [u('a', 10)];
    const local = [u('a', 10), u('legacy', undefined)];
    expect(mergeHistory(incoming, local)).toEqual([u('a', 10)]);
  });
});
