import { describe, it, expect } from 'vitest';
import type { ToolCall } from '../../shared/protocol';
import type { CanvasCard } from '../../shared/canvas';
import { toolGameEvent, newlyDone, cardStatuses } from './real-events';
import { applyEvent, emptyState, REAL_XP_DAILY_CAP, XP } from './engine';

const tool = (over: Partial<ToolCall>): ToolCall => ({ id: 't1', name: 'Bash', label: 'Bash', command: 'gh pr merge 12 --squash', status: 'done', output: [], ...over });
const card = (id: string, status: CanvasCard['status']): CanvasCard => ({ id, title: id, prompt: '', status, kind: 'task', contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0 });
const now = new Date(2026, 9, 31, 12);

describe('toolGameEvent', () => {
  it('rewards a finished gh pr merge, keyed by the tool id', () => {
    expect(toolGameEvent(tool({}))).toEqual({ type: 'pr_merged', key: 't1' });
    expect(toolGameEvent(tool({ command: 'cd x && gh pr merge 3 --squash --delete-branch' }))).toMatchObject({ type: 'pr_merged' });
  });
  it('ignores running, failed, auto-merge and other commands', () => {
    expect(toolGameEvent(tool({ status: 'running' }))).toBeNull();
    expect(toolGameEvent(tool({ status: 'error' }))).toBeNull();
    expect(toolGameEvent(tool({ exit: 1 }))).toBeNull();
    expect(toolGameEvent(tool({ command: 'gh pr merge 3 --auto' }))).toBeNull();
    expect(toolGameEvent(tool({ command: 'gh pr view 3' }))).toBeNull();
    expect(toolGameEvent(tool({ command: 'echo gh pr merge' , name: 'Read' }))).toBeNull();
  });
});

describe('newlyDone', () => {
  it('treats the first snapshot as a baseline', () => {
    expect(newlyDone(null, [card('a', 'done')])).toEqual([]);
  });
  it('returns only cards that moved into done', () => {
    const prev = cardStatuses([card('a', 'doing'), card('b', 'done'), card('c', 'todo')]);
    const next = [card('a', 'done'), card('b', 'done'), card('c', 'todo'), card('new', 'done')];
    expect(newlyDone(prev, next).map((c) => c.id)).toEqual(['a']);
  });
});

describe('real events in the engine', () => {
  it('pays XP and unlocks the first-merge achievement', () => {
    const { state, rewards } = applyEvent(emptyState(), { type: 'pr_merged' }, now);
    expect(state.xp).toBeGreaterThanOrEqual(XP.prMerged);
    expect(rewards).toContainEqual({ kind: 'achievement', id: 'pr-1' });
  });
  it('caps XP per day so toggling a card cannot farm', () => {
    let s = emptyState();
    for (let i = 0; i < REAL_XP_DAILY_CAP + 3; i++) s = applyEvent(s, { type: 'task_done' }, now).state;
    expect(s.totals.task_done).toBe(REAL_XP_DAILY_CAP + 3);
    const capped = applyEvent(s, { type: 'task_done' }, now);
    expect(capped.rewards.some((r) => r.kind === 'xp')).toBe(false);
  });
});
