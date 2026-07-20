import { describe, it, expect } from 'vitest';
import { groupByTopic } from './group-by-topic';
import type { Session } from '../../data/mock';

const s = (id: string, mtime = 0): Session => ({ id, title: id, mtime } as Session);

describe('groupByTopic', () => {
  it('agrupa por tag e joga sem-tag em "Sem tópico" no fim', () => {
    const list = [s('a'), s('b'), s('c')];
    const tagMap = { a: ['work'], b: ['work'] };
    const g = groupByTopic(list, tagMap);
    expect(g.map((x) => x.label)).toEqual(['work', 'Sem tópico']);
    expect(g[0].items.map((x) => x.id)).toEqual(['a', 'b']);
    expect(g[1].items.map((x) => x.id)).toEqual(['c']);
    expect(g[1].untagged).toBe(true);
  });

  it('sessão multi-tag aparece em cada tópico', () => {
    const g = groupByTopic([s('a')], { a: ['x', 'y'] });
    expect(g.map((x) => x.label).sort()).toEqual(['x', 'y']);
  });

  it('ordena tópicos por tamanho e depois alfabético', () => {
    const list = [s('a'), s('b'), s('c'), s('d')];
    const tagMap = { a: ['big'], b: ['big'], c: ['big'], d: ['aaa'] };
    const g = groupByTopic(list, tagMap);
    expect(g.map((x) => x.label)).toEqual(['big', 'aaa']);
  });

  it('sem sessões sem-tag não gera o balde "Sem tópico"', () => {
    const g = groupByTopic([s('a')], { a: ['t'] });
    expect(g.map((x) => x.label)).toEqual(['t']);
  });

  it('todos os grupos de tópico marcam topic=true', () => {
    const g = groupByTopic([s('a'), s('b')], { a: ['t'] });
    expect(g.every((x) => x.topic)).toBe(true);
  });
});
