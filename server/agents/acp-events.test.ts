import { describe, it, expect } from 'vitest';
import { closeDangling, mapUpdate, permissionOutcome, resultSubtype, toolBlockOf, type MapCtx } from './acp-events';

const ctx = (): MapCtx => ({ sessionId: 'sid', tools: new Map() });

describe('mapUpdate', () => {
  it('streams message and thought chunks as deltas', () => {
    const c = ctx();
    expect(mapUpdate({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'oi' } }, c)).toEqual([
      { type: 'stream_event', session_id: 'sid', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'oi' } } },
    ]);
    const [t] = mapUpdate({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hm' } }, c) as any[];
    expect(t.event.delta).toEqual({ type: 'thinking_delta', thinking: 'hm' });
  });

  it('ignores empty chunks and unknown updates', () => {
    expect(mapUpdate({ sessionUpdate: 'agent_message_chunk', content: { type: 'image' } }, ctx())).toEqual([]);
    expect(mapUpdate({ sessionUpdate: 'plan', entries: [] }, ctx())).toEqual([]);
    expect(mapUpdate(undefined, ctx())).toEqual([]);
  });

  it('opens a tool card and closes it once on completion', () => {
    const c = ctx();
    const open = mapUpdate({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'ls', kind: 'execute', status: 'pending', rawInput: { command: 'ls -la' } }, c) as any[];
    expect(open).toHaveLength(1);
    expect(open[0].message.content[0]).toEqual({ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls -la', description: 'ls' } });
    expect(mapUpdate({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'in_progress' }, c)).toEqual([]);
    const done = mapUpdate({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'a.txt' } }] }, c) as any[];
    expect(done[0].message.content[0]).toEqual({ type: 'tool_result', tool_use_id: 't1', content: 'a.txt', is_error: false });
    expect(mapUpdate({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }, c)).toEqual([]);
  });

  it('marks a failed tool as error and opens a card for an update it never saw', () => {
    const c = ctx();
    const evs = mapUpdate({ sessionUpdate: 'tool_call_update', toolCallId: 'x', title: 'Read', kind: 'read', status: 'failed', locations: [{ path: '/a' }] }, c) as any[];
    expect(evs.map((e) => e.type)).toEqual(['assistant', 'user']);
    expect(evs[0].message.content[0].input).toEqual({ file_path: '/a' });
    expect(evs[1].message.content[0].is_error).toBe(true);
  });
});

describe('toolBlockOf', () => {
  it('turns an ACP diff into an Edit card', () => {
    expect(toolBlockOf({ kind: 'edit', title: 'edit', content: [{ type: 'diff', path: '/f.ts', oldText: 'a', newText: 'b' }] }))
      .toEqual({ name: 'Edit', input: { file_path: '/f.ts', old_string: 'a', new_string: 'b' } });
  });
  it('keeps the agent title for unknown kinds', () => {
    expect(toolBlockOf({ kind: 'other', title: 'x_search', rawInput: { q: 1 } })).toEqual({ name: 'x_search', input: { q: 1 } });
  });
});

describe('closeDangling', () => {
  it('closes only tools still open', () => {
    const c = ctx();
    mapUpdate({ sessionUpdate: 'tool_call', toolCallId: 'a', title: 't', status: 'pending' }, c);
    mapUpdate({ sessionUpdate: 'tool_call', toolCallId: 'b', title: 't', status: 'completed' }, c);
    const evs = closeDangling(c, true) as any[];
    expect(evs).toHaveLength(1);
    expect(evs[0].message.content[0].tool_use_id).toBe('a');
    expect(closeDangling(c, true)).toEqual([]);
  });
});

describe('permissionOutcome', () => {
  const options = [
    { optionId: 'y', kind: 'allow_once' },
    { optionId: 'yy', kind: 'allow_always' },
    { optionId: 'n', kind: 'reject_once' },
  ];
  it('allows once outside plan mode', () => {
    expect(permissionOutcome(options, 'default')).toEqual({ outcome: 'selected', optionId: 'y' });
  });
  it('rejects in plan mode', () => {
    expect(permissionOutcome(options, 'plan')).toEqual({ outcome: 'selected', optionId: 'n' });
  });
  it('cancels when nothing matches', () => {
    expect(permissionOutcome([{ optionId: 'y', kind: 'allow_once' }], 'plan')).toEqual({ outcome: 'cancelled' });
    expect(permissionOutcome('junk', undefined)).toEqual({ outcome: 'cancelled' });
  });
});

describe('resultSubtype', () => {
  it('maps stop reasons', () => {
    expect(resultSubtype('end_turn')).toEqual({ subtype: 'success', isError: false });
    expect(resultSubtype('refusal')).toEqual({ subtype: 'refusal', isError: true });
    expect(resultSubtype('max_turn_requests').isError).toBe(true);
  });
});
