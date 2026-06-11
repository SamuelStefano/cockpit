import { describe, it, expect } from 'vitest';
import { emitTool, closeTool } from './tools';
import type { Thread } from './runs';

function freshThread(): Thread {
  return { handle: { kill: () => {} }, prompt: '', startedAt: 0, text: '', thinking: '', tools: [], toolStart: new Map(), tasks: new Map(), taskCreates: new Map() };
}

describe('snapshotTool merge (replay snapshot)', () => {
  it('preserves running name/command when the done frame arrives with placeholders', () => {
    const t = freshThread();
    emitTool(t, 'k', { id: 'a', name: 'Bash', input: { command: 'ls -la' } }, 'running');
    closeTool(t, 'k', { tool_use_id: 'a', content: 'file1\nfile2' });
    expect(t.tools).toHaveLength(1);
    const tool = t.tools[0];
    expect(tool.name).toBe('Bash');
    expect(tool.command).toBe('ls -la');
    expect(tool.status).toBe('done');
    expect(tool.output).toEqual(['file1', 'file2']);
  });

  it('keeps diff/markdown from the running frame after close', () => {
    const t = freshThread();
    emitTool(t, 'k', { id: 'e', name: 'Edit', input: { file_path: '/x', old_string: 'a', new_string: 'b' } }, 'running');
    const diff = t.tools[0].diff;
    expect(diff).toBeTruthy();
    closeTool(t, 'k', { tool_use_id: 'e', content: '' });
    expect(t.tools[0].name).toBe('Edit');
    expect(t.tools[0].diff).toEqual(diff);
  });

  it('marks error status and exit on is_error result', () => {
    const t = freshThread();
    emitTool(t, 'k', { id: 'b', name: 'Bash', input: { command: 'false' } }, 'running');
    closeTool(t, 'k', { tool_use_id: 'b', content: 'boom', is_error: true });
    expect(t.tools[0].status).toBe('error');
    expect(t.tools[0].exit).toBe(1);
  });
});

describe('snapshotTool caps (OOM guard)', () => {
  it('caps retained tools at 300 and prunes their toolStart entries', () => {
    const t = freshThread();
    for (let i = 0; i < 350; i++) {
      emitTool(t, 'k', { id: `t${i}`, name: 'Bash', input: { command: `c${i}` } }, 'running');
    }
    expect(t.tools).toHaveLength(300);
    expect(t.tools[0].id).toBe('t50');
    expect(t.toolStart.has('t0')).toBe(false);
    expect(t.toolStart.has('t349')).toBe(true);
    expect(t.toolStart.size).toBe(300);
  });
});

describe('capOutput (tool output cap)', () => {
  it('truncates output past the cap and appends a marker', () => {
    const t = freshThread();
    emitTool(t, 'k', { id: 'big', name: 'Read', input: { file_path: '/big' } }, 'running');
    const huge = 'x'.repeat(300 * 1024);
    closeTool(t, 'k', { tool_use_id: 'big', content: huge });
    const out = t.tools[0].output;
    const total = out.join('').length;
    expect(total).toBeLessThan(huge.length);
    expect(out[out.length - 1]).toContain('truncada');
  });
});
