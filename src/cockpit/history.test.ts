import { describe, it, expect } from 'vitest';
import { mergeHistory } from './history';
import type { Message, TurnBubbleStats } from '../../shared/protocol';

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

const a = (id: string, stats?: TurnBubbleStats): Message =>
  ({ id, role: 'assistant', blocks: [{ type: 'text', md: id }], ts: 10, ...(stats ? { stats } : {}) });

describe('mergeHistory — stats do turno (S3: re-fetch apagava tokens/custo)', () => {
  it('mantém stats locais quando o snapshot vem sem stats', () => {
    const local = [a('x', { tokens: 500, durationMs: 1000, costUsd: 0.04 })];
    const out = mergeHistory([a('x')], local);
    expect((out[0] as any).stats).toEqual({ tokens: 500, durationMs: 1000, costUsd: 0.04 });
  });

  it('snapshot com stats mas sem costUsd herda o costUsd local (JSONL não tem custo)', () => {
    const local = [a('x', { tokens: 500, costUsd: 0.04 })];
    const out = mergeHistory([a('x', { tokens: 600, durationMs: 2000 })], local);
    expect((out[0] as any).stats).toEqual({ tokens: 600, durationMs: 2000, costUsd: 0.04 });
  });

  it('snapshot com stats completas vence (autoritativo)', () => {
    const local = [a('x', { tokens: 1, costUsd: 0.01 })];
    const out = mergeHistory([a('x', { tokens: 600, costUsd: 0.05 })], local);
    expect((out[0] as any).stats).toEqual({ tokens: 600, costUsd: 0.05 });
  });

  it('sem contraparte local: snapshot passa intocado', () => {
    const out = mergeHistory([a('x', { tokens: 600 })], [u('z', 5)]);
    expect((out[0] as any).stats).toEqual({ tokens: 600 });
  });

  it('bolha ao vivo órfã (id sintético a-xxx) doa o costUsd pro último assistant do snapshot', () => {
    const local = [a('a-live', { tokens: 500, costUsd: 0.04 })];
    const out = mergeHistory([a('uuid-1', { tokens: 100 }), a('uuid-2', { tokens: 500, durationMs: 9000 })], local);
    expect((out[0] as any).stats).toEqual({ tokens: 100 });
    expect((out[1] as any).stats).toEqual({ tokens: 500, durationMs: 9000, costUsd: 0.04 });
  });

  it('órfã sem costUsd: nada herdado; último assistant SEM stats herda o custo mesmo assim', () => {
    const out1 = mergeHistory([a('uuid-1', { tokens: 100 })], [a('a-live', { tokens: 500 })]);
    expect((out1[0] as any).stats).toEqual({ tokens: 100 });
    const out2 = mergeHistory([a('uuid-1')], [a('a-live', { tokens: 500, costUsd: 0.04 })]);
    expect((out2[0] as any).stats).toEqual({ tokens: 0, inputTokens: 0, outputTokens: 0, costUsd: 0.04 });
  });

  it('último assistant já com costUsd próprio não é sobrescrito pela órfã', () => {
    const local = [a('a-live', { tokens: 500, costUsd: 0.99 })];
    const out = mergeHistory([a('uuid-1', { tokens: 100, costUsd: 0.01 })], local);
    expect((out[0] as any).stats).toEqual({ tokens: 100, costUsd: 0.01 });
  });
});
