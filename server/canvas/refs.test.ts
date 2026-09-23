import { describe, it, expect } from 'vitest';
import { emptyRefs, scanRefsBuffer, scanRefsLine } from './refs';

const toolLine = (name: string, input: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });

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

  it('binds the card from the first user message marker only', () => {
    const r = emptyRefs();
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: 'do it\n[deck-card:abcd-12]' } }), r);
    scanRefsLine(JSON.stringify({ type: 'user', message: { content: '[deck-card:zzzz-99]' } }), r);
    expect(r.cardId).toBe('abcd-12');
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
