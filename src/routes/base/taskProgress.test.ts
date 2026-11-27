import { describe, expect, it } from 'vitest';
import { progressLabel, taskProgress } from './taskProgress';

const todos = [{ content: 'a', status: 'completed' as const }, { content: 'b', activeForm: 'Doing b', status: 'in_progress' as const }, { content: 'c', status: 'pending' as const }];

describe('taskProgress', () => {
  it('counts finished items and names the current one while running', () => {
    expect(progressLabel(taskProgress(todos, true)!)).toBe('1/3 · Doing b');
  });
  it('drops the current item when the session is not running', () => {
    expect(progressLabel(taskProgress(todos, false)!)).toBe('1/3');
  });
  it('has nothing to show without todos', () => {
    expect(taskProgress(undefined, true)).toBeNull();
    expect(taskProgress([], true)).toBeNull();
  });
});
