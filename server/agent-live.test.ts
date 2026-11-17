import { describe, it, expect, beforeEach } from 'vitest';
import type { ToolCall } from '../shared/protocol';
import { liveFromTool, terminalTail, recordLiveTool, getLive, clearLive, LIVE_DIFF_MAX, LIVE_TAIL_LINES } from './agent-live';
import { MASK, SENSITIVE_FILE_NOTE } from './redact-secrets';

const tool = (o: Partial<ToolCall>): ToolCall => ({ id: 't1', name: 'Bash', label: 'Bash', command: '', status: 'running', output: [], ...o });
const home = '/home/u';

beforeEach(() => clearLive());

describe('liveFromTool', () => {
  it('tracks tool name and redacted command', () => {
    const l = liveFromTool(undefined, tool({ command: 'curl -H "Authorization: Bearer abcdefghijkl" x' }), 1, home);
    expect(l).toMatchObject({ tool: 'Bash', status: 'running', at: 1 });
    expect(l.command).toContain(MASK);
    expect(l.command).not.toContain('abcdefghijkl');
  });

  it('derives step index/total from todos', () => {
    const todos = [
      { content: 'a', status: 'completed' as const },
      { content: 'b', status: 'in_progress' as const, activeForm: 'Running tests' },
      { content: 'c', status: 'pending' as const },
    ];
    expect(liveFromTool(undefined, tool({ name: 'TodoWrite', todos }), 1, home)).toMatchObject({ step: 'Running tests', stepIndex: 2, stepTotal: 3 });
  });

  it('a close event keeps the tool name and updates the status', () => {
    const a = liveFromTool(undefined, tool({ command: 'ls' }), 1, home);
    const b = liveFromTool(a, tool({ name: 'tool', label: 'tool', status: 'done' }), 2, home);
    expect(b).toMatchObject({ tool: 'Bash', command: 'ls', status: 'done', at: 2 });
  });

  it('streams a redacted, capped diff', () => {
    const l = liveFromTool(undefined, tool({ name: 'Edit', diff: { path: '/home/u/app/x.ts', old: 'a', new: 'const k = "sk-ant-' + 'z'.repeat(30) + '";' } }), 1, home);
    expect(l.file?.path).toBe('~/app/x.ts');
    expect(l.file?.diff).toContain('- a');
    expect(l.file?.diff).toContain(MASK);
    expect(l.file?.diff).not.toContain('zzzz');
    const big = liveFromTool(undefined, tool({ name: 'Write', diff: { path: '/r/big.ts', old: '', new: 'x'.repeat(50_000) } }), 1, home);
    expect(big.file!.diff.length).toBeLessThanOrEqual(LIVE_DIFF_MAX);
    expect(big.file!.truncated).toBe(true);
  });

  it('never streams the content of sensitive files', () => {
    for (const path of ['/home/u/.ssh/config', '/home/u/.deck-drop/a', '/home/u/.config/dfl/prod.env', '/r/.env', '/r/credentials.json']) {
      const l = liveFromTool(undefined, tool({ name: 'Write', diff: { path, old: '', new: 'PLAIN_VALUE_NOT_A_PATTERN' } }), 1, home);
      expect(l.file, path).toMatchObject({ diff: SENSITIVE_FILE_NOTE, hidden: true });
      expect(JSON.stringify(l)).not.toContain('PLAIN_VALUE');
    }
  });

  it('a new tool clears the previous file', () => {
    const a = liveFromTool(undefined, tool({ name: 'Edit', diff: { path: '/r/a.ts', old: '', new: 'x' } }), 1, home);
    expect(liveFromTool(a, tool({ name: 'Bash', command: 'ls' }), 2, home).file).toBeUndefined();
  });
});

describe('terminalTail', () => {
  it('keeps the last lines, redacted and capped per line', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    lines.push('export GITHUB_TOKEN=ghp_' + 'a'.repeat(36), 'y'.repeat(1000));
    const t = terminalTail(lines);
    expect(t).toHaveLength(LIVE_TAIL_LINES);
    expect(t.join('\n')).not.toContain('aaaaaaaa');
    expect(t.at(-1)!.length).toBeLessThanOrEqual(300);
  });
});

describe('per-bot store', () => {
  it('keeps one entry per bot', () => {
    recordLiveTool('capo1', tool({ command: 'ls' }));
    recordLiveTool('capo2', tool({ name: 'Read' }));
    expect(getLive('capo1')?.tool).toBe('Bash');
    expect(getLive('capo2')?.tool).toBe('Read');
    clearLive('capo1');
    expect(getLive('capo1')).toBeUndefined();
  });
});
