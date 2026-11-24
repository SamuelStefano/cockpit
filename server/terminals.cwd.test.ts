import { describe, it, expect } from 'vitest';
import { openTerm, safeTermCwd, stripControl, tmuxArgs } from './terminals';

const ROOT = '/home/u/.cockpit/bots';

describe('safeTermCwd', () => {
  it('accepts a directory under botsRoot', () => {
    expect(safeTermCwd(`${ROOT}/capo1/workspace`, ROOT)).toBe(`${ROOT}/capo1/workspace`);
    expect(safeTermCwd(`${ROOT}/capo1/workspace/`, `${ROOT}/`)).toBe(`${ROOT}/capo1/workspace/`);
  });

  it('refuses anything outside, traversal, relative paths and junk', () => {
    expect(safeTermCwd(ROOT, ROOT)).toBeNull();
    expect(safeTermCwd('/home/u', ROOT)).toBeNull();
    expect(safeTermCwd(`${ROOT}-evil/x`, ROOT)).toBeNull();
    expect(safeTermCwd(`${ROOT}/capo1/../../../etc`, ROOT)).toBeNull();
    expect(safeTermCwd(`${ROOT}/capo1/..`, ROOT)).toBeNull();
    expect(safeTermCwd('capo1/workspace', ROOT)).toBeNull();
    expect(safeTermCwd(`${ROOT}/a\0b`, ROOT)).toBeNull();
    expect(safeTermCwd(undefined, ROOT)).toBeNull();
    expect(safeTermCwd(42, ROOT)).toBeNull();
  });
});

describe('openTerm with a cwd', () => {
  it('refuses a cwd outside botsRoot before spawning anything', () => {
    const noop = () => {};
    expect(openTerm('bot-capo1', 80, 24, noop, noop, noop, undefined, '/etc')).toBe(false);
    expect(openTerm('bot-capo1', 80, 24, noop, noop, noop, undefined, process.env.HOME ?? '/root')).toBe(false);
  });
});

describe('tmuxArgs cwd', () => {
  it('starts the session in the given cwd', () => {
    const args = tmuxArgs('bot-capo1', undefined, `${ROOT}/capo1/workspace`)!;
    expect(args[args.indexOf('-c') + 1]).toBe(`${ROOT}/capo1/workspace`);
  });
});

describe('stripControl', () => {
  it('drops escape sequences and C0/C1 bytes, keeps text, tab and newline', () => {
    expect(stripControl('\x1b[31mred\x1b[0m\tok\nline')).toBe('red\tok\nline');
    expect(stripControl('a\x1b]0;title\x07b')).toBe('ab');
    expect(stripControl('bell\x07 bs\x08 del\x7f c1\x9b31m\x85x')).toBe('bell bs del c1x');
    expect(stripControl('x\x1bPq#0;2;0;0;0\x1b\\y')).toBe('xy');
    expect(stripControl('ação ✓')).toBe('ação ✓');
  });
});
