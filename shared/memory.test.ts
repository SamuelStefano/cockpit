import { describe, it, expect } from 'vitest';
import type { Memory } from './protocol';
import { buildMemoryBlock, memoryBytesFor, readersOf, MAX_PROMPT_MEMORY_BYTES, MEMORY_CUT_NOTICE } from './memory';

const mem = (id: string, agents: string[], body = 'corpo', updatedAt = 1): Memory => ({ id, title: `T ${id}`, body, agents, updatedAt, updatedBy: 'user' });
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('buildMemoryBlock', () => {
  it('is empty when there are no memories or none is read by the bot', () => {
    expect(buildMemoryBlock(undefined, 'a')).toBe('');
    expect(buildMemoryBlock([], 'a')).toBe('');
    expect(buildMemoryBlock([mem('1', ['b'])], 'a')).toBe('');
  });

  it('includes only memories read by the bot, newest first', () => {
    const out = buildMemoryBlock([mem('old', ['a'], 'x', 1), mem('new', ['a'], 'y', 5), mem('other', ['b'])], 'a');
    expect(out.indexOf('T new')).toBeLessThan(out.indexOf('T old'));
    expect(out).not.toContain('T other');
  });

  it('caps at 8 KB with a notice', () => {
    const out = buildMemoryBlock([mem('1', ['a'], 'é'.repeat(6000)), mem('2', ['a'], 'z'.repeat(6000), 0)], 'a');
    expect(bytes(out)).toBeLessThanOrEqual(MAX_PROMPT_MEMORY_BYTES);
    expect(out.endsWith(MEMORY_CUT_NOTICE)).toBe(true);
    expect(out).not.toContain('�');
  });

  it('does not add a notice when everything fits', () => {
    expect(buildMemoryBlock([mem('1', ['a'])], 'a')).not.toContain(MEMORY_CUT_NOTICE);
  });
});

describe('readers', () => {
  it('counts the bytes a bot would receive', () => {
    expect(memoryBytesFor([mem('1', ['a'], 'x'.repeat(100))], 'a')).toBeGreaterThan(100);
    expect(memoryBytesFor([mem('1', ['b'])], 'a')).toBe(0);
    expect(readersOf([mem('1', ['a'])], 'a')).toHaveLength(1);
  });
});
