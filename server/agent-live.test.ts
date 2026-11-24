import { describe, it, expect, beforeEach } from 'vitest';
import type { ToolCall } from '../shared/protocol';
import { liveFromTool, terminalTail, recordLiveTool, getLive, clearLive, endLive, maskCutTail, LIVE_DIFF_MAX, LIVE_TAIL_LINES } from './agent-live';
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

const BODY = ['MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun', 'VTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxK', 'LxoS2tFczGkPLPgizskuemMghRniWaoLcyehkd3qqGElvW/VDL5AaWTg0nLVkjRo'];

describe('terminalTail: multi-line PEM', () => {
  const secretBits = (out: string[]) => BODY.some((b) => out.join('\n').includes(b.slice(0, 20)));

  it('masks a full PEM block printed in the terminal', () => {
    const out = terminalTail(['$ cat key', '-----BEGIN ' + 'RSA PRIVATE KEY-----', ...BODY, '-----END RSA PRIVATE KEY-----', '$ ls']);
    expect(secretBits(out)).toBe(false);
    expect(out[0]).toBe('$ cat key');
    expect(out.at(-1)).toBe('$ ls');
  });

  it('masks everything after a BEGIN with no END in the window', () => {
    const out = terminalTail(['$ cat key', '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----', ...BODY]);
    expect(secretBits(out)).toBe(false);
  });

  it('masks everything before an END whose BEGIN scrolled out', () => {
    const out = terminalTail([...BODY, '-----END OPENSSH PRIVATE KEY-----', '$ ls']);
    expect(secretBits(out)).toBe(false);
    expect(out.at(-1)).toBe('$ ls');
  });

  it('masks a lone key body line, keeps hex digests', () => {
    const hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(terminalTail([BODY[1], hex])).toEqual([MASK, hex]);
  });
});

describe('diff cap boundary', () => {
  it('masks a token cut by the cap', () => {
    const pad = 'x '.repeat((LIVE_DIFF_MAX - 20) / 2);
    const l = liveFromTool(undefined, tool({ name: 'Write', diff: { path: '/r/a.ts', old: '', new: pad + 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ' } }), 1, home);
    expect(l.file!.diff.endsWith(MASK)).toBe(true);
    expect(l.file!.diff).not.toContain('abcdefgh');
  });
  it('maskCutTail leaves a word boundary alone', () => {
    expect(maskCutTail('hello world ')).toBe('hello world ');
    expect(maskCutTail('k = AbCdEfGh123')).toBe(`k = ${MASK}`);
  });
});

describe('endLive', () => {
  it('drops the bot state when its turn ends, so it does not linger as live', () => {
    recordLiveTool('capo1', tool({ command: 'ls' }));
    endLive('capo1');
    endLive(undefined);
    expect(getLive('capo1')).toBeUndefined();
  });
});
