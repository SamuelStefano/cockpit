import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { botWorkspace, restrictedTurn, restrictedModelError, stripRestricted, ensureWorkspace, RESTRICTED_DENY } from './restricted-profile';

const prev = process.env.COCKPIT_BOTS_DIR;
afterEach(() => { if (prev === undefined) delete process.env.COCKPIT_BOTS_DIR; else process.env.COCKPIT_BOTS_DIR = prev; });

function turn(o: { botId?: string; mode?: string }, dirName = '-home-x', home = '/home/x') {
  process.env.COCKPIT_BOTS_DIR = '/srv/bots';
  const r = restrictedTurn(o, dirName, home);
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('botWorkspace', () => {
  it('lives under the bots root, one dir per bot', () => {
    process.env.COCKPIT_BOTS_DIR = '/srv/bots';
    expect(botWorkspace('abcd1')).toBe('/srv/bots/abcd1/workspace');
  });
  it('refuses an id that could climb out of the root', () => {
    for (const id of ['../x', 'a/b', '', 'AB12', undefined]) expect(botWorkspace(id)).toBeUndefined();
  });
});

describe('restrictedTurn', () => {
  it('cwd is the workspace and file rules are absolute paths inside it', () => {
    const r = turn({ botId: 'abcd1', mode: 'auto' });
    expect(r.cwd).toBe('/srv/bots/abcd1/workspace');
    expect(r.allow).toEqual(expect.arrayContaining([
      'Read(//srv/bots/abcd1/workspace/**)', 'Edit(//srv/bots/abcd1/workspace/**)', 'Write(//srv/bots/abcd1/workspace/**)',
    ]));
    expect(r.allow.some((a) => a === 'Edit' || a === 'Write' || a === 'Read')).toBe(false);
  });
  it('never allows a shell and denies it explicitly', () => {
    const r = turn({ botId: 'abcd1', mode: 'acceptEdits' });
    for (const t of ['Bash', 'BashOutput', 'KillShell', 'NotebookEdit', 'Monitor']) {
      expect(r.allow).not.toContain(t);
      expect(r.deny).toContain(t);
    }
    expect(RESTRICTED_DENY).toContain('Bash');
  });
  it('limits the built-in tool set and turns on the CLI restricted mode', () => {
    const r = turn({ botId: 'abcd1' });
    expect(r.args[0]).toBe('--restricted');
    expect(r.args[1]).toBe('--tools');
    expect(r.args[2].split(' ')).not.toContain('Bash');
    expect(r.args[2].split(' ')).toContain('AskUserQuestion');
  });
  it('auto and acceptEdits both land on default; plan stays plan with nothing allowed', () => {
    expect(turn({ botId: 'abcd1', mode: 'auto' }).permissionMode).toBe('default');
    expect(turn({ botId: 'abcd1', mode: 'acceptEdits' }).permissionMode).toBe('default');
    expect(turn({ botId: 'abcd1', mode: 'bypassPermissions' }).permissionMode).toBe('default');
    const plan = turn({ botId: 'abcd1', mode: 'plan' });
    expect(plan.permissionMode).toBe('plan');
    expect(plan.allow).toEqual([]);
  });
  it('pins the transcript to the Deck projects dir and turns off auto-memory', () => {
    const r = turn({ botId: 'abcd1' });
    expect(r.env).toEqual({ CLAUDE_CONFIG_DIR: '/home/x/.claude', CLAUDE_CODE_PROJECT_DIR_NAME: '-home-x', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' });
  });
  it('fails closed without a bot, with a path that would split the rule, or a dir name the CLI ignores', () => {
    process.env.COCKPIT_BOTS_DIR = '/srv/bots';
    expect('error' in restrictedTurn({}, '-home-x')).toBe(true);
    expect('error' in restrictedTurn({ botId: 'abcd1' }, `-${'a'.repeat(70)}`)).toBe(true);
    process.env.COCKPIT_BOTS_DIR = '/srv/my bots';
    expect('error' in restrictedTurn({ botId: 'abcd1' }, '-home-x')).toBe(true);
  });
});

describe('restrictedModelError', () => {
  it('refuses an ACP agent only on a restricted turn', () => {
    expect(restrictedModelError('restricted', 'agent:grok')).toMatch(/agente externo/);
    expect(restrictedModelError('restricted', 'haiku')).toBeNull();
    expect(restrictedModelError('full', 'agent:grok')).toBeNull();
    expect(restrictedModelError(undefined, 'agent:grok')).toBeNull();
  });
});

describe('stripRestricted', () => {
  it('drops MCPs, bypass and the workflow grant from a restricted turn', () => {
    expect(stripRestricted({ profile: 'restricted' as const, mcps: ['*'], bypass: true, allowWorkflow: true, model: 'haiku' }))
      .toEqual({ profile: 'restricted', model: 'haiku' });
  });
  it('leaves any other turn untouched', () => {
    const p = { profile: 'full' as const, mcps: ['x'], bypass: true };
    expect(stripRestricted(p)).toBe(p);
  });
});

describe('ensureWorkspace', () => {
  it('creates the dir on demand, private to the owner', () => {
    const root = mkdtempSync(join(tmpdir(), 'deck-ws-'));
    try {
      const dir = join(root, 'b1', 'workspace');
      expect(ensureWorkspace(dir)).toBe(true);
      expect(statSync(dir).mode & 0o777).toBe(0o700);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
