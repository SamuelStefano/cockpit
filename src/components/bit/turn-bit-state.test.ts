import { describe, it, expect } from 'vitest';
import type { Block, Message } from '../../data/types';
import { turnBitState, liveTurnBlocks } from './turn-bit-state';

const text: Block = { type: 'text', md: 'oi' };
const think: Block = { type: 'thinking', text: 'hmm' };
const tool = (status: 'running' | 'done' | 'error'): Block => ({ type: 'tool', tool: { id: 't', name: 'Bash', label: 'Bash', command: 'ls', status } });

describe('turnBitState', () => {
  it('thinks while waiting for the first token', () => {
    expect(turnBitState({ phase: 'thinking' })).toBe('thinking');
    expect(turnBitState({ phase: 'streaming', blocks: [] })).toBe('thinking');
  });

  it('thinks while thinking tokens stream', () => {
    expect(turnBitState({ phase: 'streaming', blocks: [think] })).toBe('thinking');
  });

  it('works while a tool runs, even after text', () => {
    expect(turnBitState({ phase: 'streaming', blocks: [text, tool('running')] })).toBe('working');
    expect(turnBitState({ phase: 'thinking', blocks: [tool('running')] })).toBe('working');
  });

  it('talks while the answer streams', () => {
    expect(turnBitState({ phase: 'streaming', blocks: [tool('done'), text] })).toBe('talking');
    expect(turnBitState({ phase: 'streaming', blocks: [{ type: 'code', lang: 'ts', code: 'x' }] })).toBe('talking');
  });

  it('goes back to thinking between finished tools', () => {
    expect(turnBitState({ phase: 'streaming', blocks: [text, tool('done')] })).toBe('thinking');
  });

  it('waits for the user on an open question or approval, even mid-turn', () => {
    expect(turnBitState({ phase: 'idle', waiting: true })).toBe('waiting');
    expect(turnBitState({ phase: 'streaming', blocks: [text], waiting: true })).toBe('waiting');
  });

  it('is sad when the turn failed or the quota is paused', () => {
    expect(turnBitState({ phase: 'idle', failed: true })).toBe('error');
    expect(turnBitState({ phase: 'idle', quotaPaused: true })).toBe('error');
    expect(turnBitState({ phase: 'streaming', blocks: [text], quotaPaused: true })).toBe('talking');
  });

  it('celebrates right after a turn, then idles', () => {
    expect(turnBitState({ phase: 'idle', justDone: true })).toBe('happy');
    expect(turnBitState({ phase: 'idle' })).toBe('idle');
  });

  it('sleeps without a link and outranks everything', () => {
    expect(turnBitState({ phase: 'streaming', blocks: [text], conn: 'closed', waiting: true, failed: true })).toBe('sleeping');
    expect(turnBitState({ phase: 'idle', conn: 'connecting' })).toBe('connecting');
  });
});

describe('liveTurnBlocks', () => {
  it('reads the trailing assistant bubble only', () => {
    const a: Message = { id: 'a', role: 'assistant', blocks: [text] };
    const u: Message = { id: 'u', role: 'user', text: 'oi' };
    expect(liveTurnBlocks([u, a])).toEqual([text]);
    expect(liveTurnBlocks([a, u])).toEqual([]);
    expect(liveTurnBlocks([])).toEqual([]);
  });
});
