import { describe, expect, it } from 'vitest';
import type { Message } from '../../data/types';
import { activityOf, filterActivity, latestAction, summaryOf } from './activity';

const tool = (name: string, command: string, over = {}) => ({ type: 'tool', tool: { id: `${name}-${command}`, name, label: name, command, status: 'done', output: [], ...over } });
const thread = [
  { id: 'u', role: 'user', text: 'Build it' },
  { id: 'a', role: 'assistant', blocks: [
    { type: 'text', md: 'On it' },
    tool('Write', '/a/new.ts', { diff: { path: '/a/new.ts', old: '', new: 'x' } }),
    tool('Edit', '/a/old.ts', { diff: { path: '/a/old.ts', old: 'a', new: 'b' } }),
    tool('Edit', '/a/new.ts', { diff: { path: '/a/new.ts', old: 'x', new: 'y' } }),
    tool('Bash', 'npm test', { status: 'error' }),
    tool('Agent', 'look', { label: 'Agent · Explore' }),
    tool('mcp__plans__create', ''),
    tool('Read', '/a/old.ts'),
  ] },
] as unknown as Message[];

describe('activityOf', () => {
  const items = activityOf(thread);
  it('keeps every action in order, not only the commands', () => {
    expect(items.map((i) => i.verb)).toEqual(['You said', 'Said', 'Wrote', 'Edited', 'Edited', 'Ran', 'Started Explore', 'Used plans · create', 'Read']);
  });
  it('filters by kind', () => {
    expect(filterActivity(items, 'file')).toHaveLength(3);
    expect(filterActivity(items, 'all')).toHaveLength(items.length);
  });
  it('summarizes a written file once, even when edited later', () => {
    expect(summaryOf(items)).toEqual({ written: ['/a/new.ts'], edited: ['/a/old.ts'], commands: 1, reads: 1, agents: 1, failed: 1 });
  });
  it('names the latest non-chat action', () => {
    expect(latestAction(items)).toBe('Read old.ts');
    expect(latestAction([])).toBeNull();
    expect(activityOf(undefined)).toEqual([]);
  });
});
