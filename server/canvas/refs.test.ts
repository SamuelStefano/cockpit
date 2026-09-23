import { describe, it, expect } from 'vitest';
import { addActivity, addWrite, emptyRefs, scanRefsBuffer, scanRefsLine, type ActivityIntervals, type FileWrites } from './refs';

let toolUseSeq = 0;
const toolLine = (name: string, input: Record<string, unknown>, timestamp?: string, id = `tu${++toolUseSeq}`) =>
  JSON.stringify({ type: 'assistant', timestamp, message: { content: [{ type: 'tool_use', id, name, input }] } });

// A write only lands in `refs.writes` once its tool_result comes back without
// is_error — this is the "user" message that follows the tool_use line.
const resultLine = (toolUseId: string, isError = false) =>
  JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError }] } });

describe('scanRefsLine', () => {
  it('records reads and writes of memory files from tool calls', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Read', { file_path: '/h/.claude/projects/x/memory/hub_deck.md' }), r);
    scanRefsLine(toolLine('Write', { file_path: '/h/.claude/projects/x/memory/deck_todo.md' }), r);
    expect(r.contexts).toEqual({ hub_deck: 'read', deck_todo: 'write' });
  });

  it('keeps write when a later read touches the same file', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Edit', { file_path: '/m/memory/a.md' }), r);
    scanRefsLine(toolLine('Read', { file_path: '/m/memory/a.md' }), r);
    expect(r.contexts.a).toBe('write');
  });

  it('counts every touch of a context regardless of kind (contextHits)', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Write', { file_path: '/m/memory/a.md' }), r);
    scanRefsLine(toolLine('Read', { file_path: '/m/memory/a.md' }), r);
    scanRefsLine(toolLine('Read', { file_path: '/m/memory/a.md' }), r);
    expect(r.contextHits).toEqual({ a: 3 });
  });

  it('reads memory paths out of Bash commands', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Bash', { command: 'cat ~/.claude/projects/x/memory/hub_dfl.md | head' }), r);
    expect(r.contexts).toEqual({ hub_dfl: 'read' });
  });

  it('ignores tool results and the MEMORY index', () => {
    const r = emptyRefs();
    const result = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: '/x/memory/a.md\n/x/memory/b.md' }] } });
    scanRefsLine(result, r);
    scanRefsLine(toolLine('Read', { file_path: '/x/memory/MEMORY.md' }), r);
    expect(r.contexts).toEqual({});
  });

  // review #597 point 3: a session "continued" for a different card later
  // than the one it launched for must end up bound to the LATEST card, not
  // the one its first turn happened to carry — consistent with card-
  // sessions.ts's lastCardMarker, applied across the whole scan.
  it('binds the card from the LAST user message marker, not the first', () => {
    const r = emptyRefs();
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: 'do it\n[deck-card:abcd-12]' } }), r);
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: '[deck-card:zzzz-99]' } }), r);
    expect(r.cardId).toBe('zzzz-99');
  });

  // The concrete case that motivated the fix: forking session for card A
  // copies A's whole transcript (marker A included) THEN appends the fork's
  // own new turn for card B — scanning top-to-bottom must land on B, the
  // turn that's actually this session's own, not the copied history's.
  it('a fork of a card-A session, prompted for card B, binds to B (not the copied A marker)', () => {
    const r = emptyRefs();
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: 'faça X\n[deck-card:card-a]' } }), r); // copied from the parent
    scanRefsLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }), r); // rest of the copied history
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: 'siga daqui\n[deck-card:card-b]' } }), r); // the fork's OWN turn
    expect(r.cardId).toBe('card-b');
  });

  it('does not bind a card mentioned by the assistant', () => {
    const r = emptyRefs();
    scanRefsLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '[deck-card:abcd-12]' }] } }), r);
    expect(r.cardId).toBeUndefined();
  });

  it('binds the LAST marker in a single message, not an earlier echoed one', () => {
    // server/canvas/flows.ts prepends the untrusted turn result ahead of its
    // own trailing marker — a result that happens to echo an unrelated
    // `[deck-card:...]` substring must not win over the real, trailing one.
    const r = emptyRefs();
    const echoedThenReal = `resultado da etapa anterior, que citou [deck-card:echoed-99] por acaso\n\nfaça algo\n\n[deck-card:real-12]`;
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: echoedThenReal } }), r);
    expect(r.cardId).toBe('real-12');
  });
});

describe('scanRefsLine — file writes', () => {
  it('records a write path with its timestamp from Edit/Write/MultiEdit/NotebookEdit, once its result confirms success', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Edit', { file_path: '/home/u/repo/src/a.ts' }, '2026-09-23T10:00:00Z', 'e1'), r);
    scanRefsLine(resultLine('e1'), r);
    scanRefsLine(toolLine('Write', { file_path: '/home/u/repo/src/b.ts' }, '2026-09-23T10:05:00Z', 'w1'), r);
    scanRefsLine(resultLine('w1'), r);
    scanRefsLine(toolLine('MultiEdit', { file_path: '/home/u/repo/src/c.ts' }, '2026-09-23T10:06:00Z', 'm1'), r);
    scanRefsLine(resultLine('m1'), r);
    scanRefsLine(toolLine('NotebookEdit', { notebook_path: '/home/u/repo/nb.ipynb' }, '2026-09-23T10:07:00Z', 'n1'), r);
    scanRefsLine(resultLine('n1'), r);
    expect(r.writes).toEqual({
      '/home/u/repo/src/a.ts': Date.parse('2026-09-23T10:00:00Z'),
      '/home/u/repo/src/b.ts': Date.parse('2026-09-23T10:05:00Z'),
      '/home/u/repo/src/c.ts': Date.parse('2026-09-23T10:06:00Z'),
      '/home/u/repo/nb.ipynb': Date.parse('2026-09-23T10:07:00Z'),
    });
  });

  it('does not record the write before its tool_result arrives', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Edit', { file_path: '/x/a.ts' }, '2026-09-23T10:00:00Z', 'e1'), r);
    expect(r.writes).toEqual({});
    expect(r.pendingWrites).toEqual({ e1: { path: '/x/a.ts', at: Date.parse('2026-09-23T10:00:00Z') } });
  });

  it('drops a write whose tool_result reports is_error — a denied or failed Edit never touched the file', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Edit', { file_path: '/x/a.ts' }, '2026-09-23T10:00:00Z', 'e1'), r);
    scanRefsLine(resultLine('e1', true), r);
    expect(r.writes).toEqual({});
    expect(r.pendingWrites).toEqual({});
  });

  it('keeps the LATEST timestamp when the same file is written twice', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Edit', { file_path: '/x/a.ts' }, '2026-09-23T10:00:00Z', 'e1'), r);
    scanRefsLine(resultLine('e1'), r);
    scanRefsLine(toolLine('Edit', { file_path: '/x/a.ts' }, '2026-09-23T09:00:00Z', 'e2'), r);
    scanRefsLine(resultLine('e2'), r);
    expect(r.writes!['/x/a.ts']).toBe(Date.parse('2026-09-23T10:00:00Z'));
  });

  it('does not track a Read as a write', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Read', { file_path: '/x/a.ts' }, '2026-09-23T10:00:00Z'), r);
    expect(r.writes).toEqual({});
  });

  it('does not JSON.parse a non-write, non-memory tool_use line (narrow parse for cost)', () => {
    const r = emptyRefs();
    // Malformed after the tool name on purpose: if this got parsed it would throw.
    const line = '{"type":"assistant","timestamp":"2026-09-23T10:00:00Z","message":{"content":[{"type":"tool_use","name":"Grep","input":BROKEN}]}}';
    expect(() => scanRefsLine(line, r)).not.toThrow();
    expect(r.writes).toEqual({});
  });

  it('caps pending writes so an unresolved run cannot grow the entry without bound', () => {
    const r = emptyRefs();
    for (let i = 0; i < 55; i++) scanRefsLine(toolLine('Edit', { file_path: `/x/f${i}.ts` }, '2026-09-23T10:00:00Z', `e${i}`), r);
    expect(Object.keys(r.pendingWrites!)).toHaveLength(50);
  });
});

describe('scanRefsLine — activity', () => {
  it('opens one interval per record timestamp and merges close ones', () => {
    const r = emptyRefs();
    scanRefsLine(toolLine('Read', { file_path: '/x/a.ts' }, '2026-09-23T10:00:00Z'), r);
    scanRefsLine(toolLine('Read', { file_path: '/x/a.ts' }, '2026-09-23T10:10:00Z'), r);
    scanRefsLine(toolLine('Read', { file_path: '/x/a.ts' }, '2026-09-23T12:00:00Z'), r);
    expect(r.activity).toEqual([
      [Date.parse('2026-09-23T10:00:00Z'), Date.parse('2026-09-23T10:10:00Z')],
      [Date.parse('2026-09-23T12:00:00Z'), Date.parse('2026-09-23T12:00:00Z')],
    ]);
  });
});

describe('addWrite', () => {
  it('evicts the oldest entries once past the cap', () => {
    const writes: FileWrites = {};
    for (let i = 0; i < 305; i++) addWrite(writes, `/x/f${i}.ts`, i);
    expect(Object.keys(writes)).toHaveLength(300);
    expect(writes['/x/f0.ts']).toBeUndefined();
    expect(writes['/x/f304.ts']).toBe(304);
  });
});

describe('addActivity', () => {
  it('merges a record within the 15min window into the previous interval', () => {
    const activity: ActivityIntervals = [];
    addActivity(activity, 0);
    addActivity(activity, 14 * 60_000);
    expect(activity).toEqual([[0, 14 * 60_000]]);
  });

  it('opens a new interval past the merge window', () => {
    const activity: ActivityIntervals = [];
    addActivity(activity, 0);
    addActivity(activity, 16 * 60_000);
    expect(activity).toEqual([[0, 0], [16 * 60_000, 16 * 60_000]]);
  });
});

describe('scanRefsBuffer', () => {
  it('consumes complete lines only and counts bytes', () => {
    const r = emptyRefs();
    const line = toolLine('Read', { file_path: '/x/memory/ç.md' }).replace('ç', 'a') + '\n';
    const buf = Buffer.from(line + '{"partial":');
    const used = scanRefsBuffer(buf, r);
    expect(used).toBe(Buffer.byteLength(line));
    expect(r.consumed).toBe(used);
    expect(r.contexts).toEqual({ a: 'read' });
  });
});
