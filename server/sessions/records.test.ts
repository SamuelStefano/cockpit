import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { num, ctxTokens, collectToolResults, activeChain, markerFromRec, readRecords, type Rec, type ToolResultRec } from './records';
import { TOOL_OUTPUT_CAP } from './tool-views';

describe('num', () => {
  it('passes through finite non-negative numbers', () => {
    expect(num(0)).toBe(0);
    expect(num(42)).toBe(42);
  });
  it('coerces numeric strings (JSONL fields can arrive as strings)', () => {
    expect(num('123')).toBe(123);
  });
  it('rejects NaN/Infinity/negatives/garbage to 0', () => {
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(-5)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num({})).toBe(0);
  });
});

describe('ctxTokens', () => {
  it('returns 0 for undefined', () => {
    expect(ctxTokens(undefined)).toBe(0);
  });
  it('sums input + cache creation + cache read', () => {
    expect(ctxTokens({ input_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 100 })).toBe(115);
  });
  it('treats missing fields as 0', () => {
    expect(ctxTokens({ input_tokens: 7 })).toBe(7);
  });
  it('never lets a dirty JSONL usage field poison the total', () => {
    expect(ctxTokens({ input_tokens: NaN as number, cache_read_input_tokens: 10 })).toBe(10);
    expect(ctxTokens({ input_tokens: '50' as unknown as number })).toBe(50);
    expect(ctxTokens({ input_tokens: -1 as number, cache_creation_input_tokens: 3 })).toBe(3);
  });
});

describe('collectToolResults', () => {
  it('extracts string content split by lines, keyed by tool_use_id', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({
      type: 'user',
      timestamp: '2026-06-10T20:20:53.000Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'line1\nline2' }] },
    } as any, map);
    expect(map.get('t1')).toMatchObject({ output: ['line1', 'line2'], isErr: false });
    expect(map.get('t1')?.ts).toBe(Date.parse('2026-06-10T20:20:53.000Z'));
  });

  it('extracts text blocks from array content and flags is_error', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({
      type: 'user',
      message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 't2', is_error: true, content: [{ type: 'text', text: 'err' }, { type: 'image' }] },
      ] },
    } as any, map);
    // blocos image agora viram placeholder '[imagem]' (paridade c/ terminal) em vez de sumir
    expect(map.get('t2')).toMatchObject({ output: ['err', '[imagem]'], isErr: true });
  });

  it('ignores non-user records, plain text content and results without tool_use_id', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'y' }] } } as any, map);
    collectToolResults({ type: 'user', message: { role: 'user', content: 'oi' } } as any, map);
    collectToolResults({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'sem id' }] } } as any, map);
    expect(map.size).toBe(0);
  });

  it('caps giant outputs with the shared truncation marker', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't3', content: 'x'.repeat(TOOL_OUTPUT_CAP + 100) }] },
    } as any, map);
    const out = map.get('t3')!.output;
    expect(out[out.length - 1]).toContain('truncada');
    expect(out.join('\n').length).toBeLessThanOrEqual(TOOL_OUTPUT_CAP + 100);
  });
});

describe('activeChain', () => {
  const mk = (uuid: string, parent: string | null, type = 'user'): Rec => ({ type, uuid, parentUuid: parent });
  const index = (recs: Rec[]) => new Map(recs.map((r) => [r.uuid!, r]));

  it('walks parentUuid root→leaf order from a valid leaf', () => {
    const recs = [mk('a', null), mk('b', 'a'), mk('c', 'b')];
    const chain = activeChain(index(recs), 'c', 'c');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to last message when the leaf is missing locally', () => {
    const recs = [mk('a', null), mk('b', 'a')];
    const chain = activeChain(index(recs), 'ghost-leaf', 'b');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b']);
  });

  it('walks through intermediate non-message records but excludes them', () => {
    const recs = [mk('a', null), { type: 'system', uuid: 's', parentUuid: 'a' } as Rec, mk('b', 's')];
    const chain = activeChain(index(recs), 'b', 'b');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b']);
  });

  it('guards against parentUuid cycles', () => {
    const recs = [mk('a', 'b'), mk('b', 'a')];
    const chain = activeChain(index(recs), 'a', 'a');
    expect(chain.length).toBe(2);
  });

  it('atravessa a compactação pelo logicalParentUuid', () => {
    const boundary: Rec = { type: 'system', uuid: 'bd', parentUuid: null, logicalParentUuid: 'b' };
    const recs = [mk('a', null), mk('b', 'a'), boundary, mk('sum', 'bd'), mk('c', 'sum')];
    const chain = activeChain(index(recs), 'c', 'c');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b', 'sum', 'c']);
  });

  it('estende até a folha real quando o leafUuid do last-prompt está defasado', () => {
    const recs = [mk('a', null), mk('b', 'a'), mk('c', 'b', 'assistant'), mk('d', 'c', 'assistant')];
    const chain = activeChain(index(recs), 'b', 'd');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('não pula pra outro ramo quando a última mensagem não descende do leaf', () => {
    const recs = [mk('a', null), mk('b', 'a'), mk('x', 'a')];
    const chain = activeChain(index(recs), 'b', 'x');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b']);
  });

  it('logicalParentUuid órfão não quebra a caminhada', () => {
    const boundary: Rec = { type: 'system', uuid: 'bd', parentUuid: null, logicalParentUuid: 'sumiu' };
    const chain = activeChain(index([boundary, mk('c', 'bd')]), 'c', 'c');
    expect(chain.map((r) => r.uuid)).toEqual(['c']);
  });
});

describe('markerFromRec (pr-link e wakeup viram divisores)', () => {
  it('pr-link vira divisor com label e url, dedup por URL', () => {
    const seen = new Set<string>();
    const rec = { type: 'pr-link', prNumber: 7, prUrl: 'https://github.com/x/y/pull/7', prRepository: 'x/y', timestamp: '2026-06-12T00:00:00.000Z' } as unknown as Rec;
    const m = markerFromRec(rec, seen);
    expect(m).toMatchObject({ role: 'compact', kind: 'pr', label: 'PR #7 · x/y', url: 'https://github.com/x/y/pull/7' });
    expect(markerFromRec(rec, seen)).toBeNull();
  });

  it('scheduled_task_fire vira divisor wakeup com o texto do harness', () => {
    const m = markerFromRec({ type: 'system', subtype: 'scheduled_task_fire', content: 'Claude resuming /loop wakeup', uuid: 'w1', timestamp: '2026-06-12T00:00:00.000Z' } as unknown as Rec, new Set());
    expect(m).toMatchObject({ id: 'w1', role: 'compact', kind: 'wakeup', label: 'Claude resuming /loop wakeup' });
  });

  it('records comuns não viram marcador', () => {
    expect(markerFromRec({ type: 'assistant' } as Rec, new Set())).toBeNull();
    expect(markerFromRec({ type: 'system', subtype: 'turn_duration' } as unknown as Rec, new Set())).toBeNull();
  });
});

// A passada única substituiu dois loops quase iguais: um lia o leaf e indexava
// tudo por uuid, o outro só acumulava a lista linear. Este teste trava as duas
// saídas juntas pra elas não voltarem a divergir.
describe('readRecords', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-records-'));
  const write = (name: string, recs: unknown[]) => {
    const p = join(dir, name);
    writeFileSync(p, recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return p;
  };

  it('devolve leaf, índice por uuid, lista linear, resultados e marcadores numa passada', async () => {
    const p = write('cheio.jsonl', [
      { type: 'user', uuid: 'u1', message: { role: 'user', content: 'oi' }, timestamp: '2026-06-12T00:00:00.000Z' },
      { type: 'attachment', uuid: 'a1', parentUuid: 'u1' },
      { type: 'assistant', uuid: 'a2', parentUuid: 'a1', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } },
      { type: 'user', uuid: 'u2', parentUuid: 'a2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'saida' }] } },
      { type: 'pr-link', prNumber: 9, prUrl: 'https://github.com/x/y/pull/9', timestamp: '2026-06-12T00:01:00.000Z' },
      { type: 'last-prompt', leafUuid: 'a2' },
    ]);
    const scan = await readRecords(p);
    expect(scan.leaf).toBe('a2');
    expect(scan.lastMsgUuid).toBe('u2');
    expect(scan.msgs.map((r) => r.uuid)).toEqual(['u1', 'a2', 'u2']);
    // records intermediários (attachment) entram no índice: sem eles a caminhada
    // parentUuid quebra no 1º nó não-mensagem e trunca o histórico.
    expect([...scan.byUuid.keys()]).toEqual(['u1', 'a1', 'a2', 'u2']);
    expect(scan.results.get('t1')?.output).toEqual(['saida']);
    expect(scan.markers.map((m) => (m as { kind?: string }).kind)).toEqual(['pr']);
  });

  it('ignora linha vazia e JSON quebrado em vez de estourar', async () => {
    const p = join(dir, 'sujo.jsonl');
    writeFileSync(p, '\n{nao é json}\n{"type":"user","uuid":"u1","message":{"role":"user","content":"ok"}}\n\n');
    const scan = await readRecords(p);
    expect(scan.msgs.map((r) => r.uuid)).toEqual(['u1']);
  });

  it('fica com o ÚLTIMO last-prompt do arquivo', async () => {
    const p = write('varios.jsonl', [
      { type: 'last-prompt', leafUuid: 'velho' },
      { type: 'last-prompt', leafUuid: 'novo' },
    ]);
    expect((await readRecords(p)).leaf).toBe('novo');
  });

  it('arquivo sem last-prompt não inventa leaf', async () => {
    const p = write('sem-leaf.jsonl', [{ type: 'user', uuid: 'u1', message: { role: 'user', content: 'oi' } }]);
    const scan = await readRecords(p);
    expect(scan.leaf).toBeUndefined();
    expect(scan.lastMsgUuid).toBe('u1');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
