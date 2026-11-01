import { describe, expect, it } from 'vitest';
import type { Message } from '../../data/types';
import { activityOf, filterActivity, lastUserTs, latestAction, newestTs, summaryOf, turnSummaries } from './activity';

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

const turns = [
  { id: 'u1', role: 'user', text: 'one', ts: 100 },
  { id: 'a1', role: 'assistant', ts: 110, blocks: [tool('Edit', '/a/x.ts'), tool('Bash', 'ls'), tool('Bash', 'pwd', { status: 'error' })] },
  { id: 'u2', role: 'user', text: ' ', ts: 150 },
  { id: 'u3', role: 'user', text: 'two', ts: 200 },
  { id: 'a2', role: 'assistant', blocks: [tool('Write', '/a/y.ts'), tool('Edit', '/a/y.ts'), tool('Edit', '/a/z.ts', { status: 'error' }), tool('TaskUpdate', 'Step 2')] },
] as unknown as Message[];

describe('turns', () => {
  const items = activityOf(turns);
  it('numbers a turn per non-empty user message', () => {
    expect(items.map((i) => i.turn)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2]);
    expect(activityOf([{ id: 'a', role: 'assistant', blocks: [tool('Read', '/a')] }] as unknown as Message[])[0].turn).toBe(0);
  });
  it('summarizes each whole turn, counting only files that worked', () => {
    const sums = turnSummaries(items);
    expect(sums.get(1)).toBe('Turn 1 · 1 file · 2 commands');
    expect(sums.get(2)).toBe('Turn 2 · 1 file');
  });
  it('shows task tool rows as task list updates', () => {
    const t = items.find((i) => i.tool?.name === 'TaskUpdate');
    expect(t).toMatchObject({ verb: 'Updated its task list', target: 'Step 2' });
  });
  it('filters failed attempts on top of a kind', () => {
    expect(filterActivity(items, 'all', true)).toHaveLength(2);
    expect(filterActivity(items, 'file', true).map((i) => i.target)).toEqual(['/a/z.ts']);
  });
  it('finds the turn start and the newest timestamp', () => {
    expect(lastUserTs(items)).toBe(200);
    expect(lastUserTs([])).toBeUndefined();
    expect(newestTs(items)).toBe(200);
    expect(newestTs(activityOf(undefined))).toBeUndefined();
  });
});
