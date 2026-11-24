import { describe, it, expect } from 'vitest';
import { LEAN_ONESHOT_ARGS, leanOneShotArgs } from './lean-args';

describe('leanOneShotArgs', () => {
  it('drops tools, skills, user settings and the transcript, with its own system prompt', () => {
    const args = leanOneShotArgs('sys', true);
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args).toContain('--disable-slash-commands');
    expect(args).toContain('--no-session-persistence');
    expect(args.slice(-2)).toEqual(['--system-prompt', 'sys']);
  });

  it('adds nothing when switched off', () => {
    expect(leanOneShotArgs('sys', false)).toEqual([]);
  });

  it('never loads MCP or tool flags that would bring definitions back', () => {
    expect(LEAN_ONESHOT_ARGS).not.toContain('--mcp-config');
    expect(LEAN_ONESHOT_ARGS).not.toContain('--allowedTools');
  });
});
