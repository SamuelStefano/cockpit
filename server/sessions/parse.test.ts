import { describe, it, expect } from 'vitest';
import { ctxTokens, diffOf, planOf, extractCommand, recToMessage, activeChain, type Rec } from './parse';

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
});

describe('diffOf', () => {
  it('extracts Edit old/new', () => {
    expect(diffOf('Edit', { file_path: '/a.ts', old_string: 'x', new_string: 'y' }))
      .toEqual({ path: '/a.ts', old: 'x', new: 'y' });
  });
  it('treats Write content as new with empty old', () => {
    expect(diffOf('Write', { file_path: '/a.ts', content: 'hello' }))
      .toEqual({ path: '/a.ts', old: '', new: 'hello' });
  });
  it('joins MultiEdit hunks into one pair', () => {
    const d = diffOf('MultiEdit', { file_path: '/a.ts', edits: [
      { old_string: 'a', new_string: 'A' },
      { old_string: 'b', new_string: 'B' },
    ] });
    expect(d).toEqual({ path: '/a.ts', old: 'a\nb', new: 'A\nB' });
  });
  it('returns undefined without a file_path', () => {
    expect(diffOf('Edit', { old_string: 'x', new_string: 'y' })).toBeUndefined();
  });
  it('returns undefined for non-diff tools', () => {
    expect(diffOf('Bash', { command: 'ls' })).toBeUndefined();
  });
});

describe('planOf', () => {
  it('extracts ExitPlanMode plan', () => {
    expect(planOf('ExitPlanMode', { plan: '# Plano' })).toBe('# Plano');
  });
  it('ignores blank or wrong tools', () => {
    expect(planOf('ExitPlanMode', { plan: '   ' })).toBeUndefined();
    expect(planOf('Edit', { plan: 'x' })).toBeUndefined();
  });
});

describe('extractCommand', () => {
  it('prefers command over other keys', () => {
    expect(extractCommand({ command: 'ls -la', file_path: '/a.ts' })).toBe('ls -la');
  });
  it('falls back through the key precedence list', () => {
    expect(extractCommand({ file_path: '/a.ts' })).toBe('/a.ts');
    expect(extractCommand({ pattern: 'foo' })).toBe('foo');
    expect(extractCommand({ url: 'https://x' })).toBe('https://x');
    expect(extractCommand({ query: 'q' })).toBe('q');
    expect(extractCommand({ description: 'd' })).toBe('d');
  });
  it('skips empty strings to reach the next key', () => {
    expect(extractCommand({ command: '', file_path: '/a.ts' })).toBe('/a.ts');
  });
  it('ignores non-string values', () => {
    expect(extractCommand({ command: 42, pattern: 'p' })).toBe('p');
  });
  it('returns empty for non-objects or no matching key', () => {
    expect(extractCommand(null)).toBe('');
    expect(extractCommand('str')).toBe('');
    expect(extractCommand({ other: 'x' })).toBe('');
  });
});

describe('recToMessage', () => {
  it('returns null when there is no message', () => {
    expect(recToMessage({ type: 'summary' } as any)).toBeNull();
  });

  it('builds a user message from string content', () => {
    const m = recToMessage({ uuid: 'u1', timestamp: '2026-06-06T00:00:00.000Z', message: { role: 'user', content: 'hello' } } as any);
    expect(m).toMatchObject({ id: 'u1', role: 'user', text: 'hello' });
    expect(m?.ts).toBe(Date.parse('2026-06-06T00:00:00.000Z'));
  });

  it('joins text parts in user array content', () => {
    const m = recToMessage({ uuid: 'u2', message: { role: 'user', content: [
      { type: 'text', text: 'a' }, { type: 'tool_result', content: 'x' }, { type: 'text', text: 'b' },
    ] } } as any);
    expect(m).toMatchObject({ role: 'user', text: 'a\nb' });
  });

  it('drops empty/whitespace-only user messages', () => {
    expect(recToMessage({ uuid: 'u3', message: { role: 'user', content: '   ' } } as any)).toBeNull();
  });

  it('builds assistant blocks for text, thinking and tool_use', () => {
    const m = recToMessage({ uuid: 'a1', message: { role: 'assistant', content: [
      { type: 'text', text: 'hi' },
      { type: 'thinking', thinking: 'hmm' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
    ] } } as any);
    expect(m?.role).toBe('assistant');
    expect((m as any).blocks).toEqual([
      { type: 'text', md: 'hi' },
      { type: 'thinking', text: 'hmm' },
      { type: 'tool', tool: expect.objectContaining({ id: 't1', name: 'Bash', command: 'ls', status: 'done' }) },
    ]);
  });

  it('returns null for assistant with no usable blocks', () => {
    expect(recToMessage({ uuid: 'a2', message: { role: 'assistant', content: [{ type: 'image' }] } } as any)).toBeNull();
  });

  it('leaves ts undefined for an unparseable timestamp', () => {
    const m = recToMessage({ uuid: 'u4', timestamp: 'not-a-date', message: { role: 'user', content: 'x' } } as any);
    expect(m?.ts).toBeUndefined();
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
});
