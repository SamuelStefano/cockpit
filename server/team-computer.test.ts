import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { botTermCwd, tildePath } from './team-computer';
import { botTermId } from '../shared/bot-term';

let dir: string;
let root: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bots-'));
  root = join(dir, 'bots');
  mkdirSync(root);
  process.env.COCKPIT_BOTS_DIR = root;
});
afterEach(() => {
  delete process.env.COCKPIT_BOTS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('botTermCwd', () => {
  it('maps a bot id to its workspace, creating it on demand', () => {
    expect(botTermCwd('capo1')).toBe(join(root, 'capo1', 'workspace'));
    expect(existsSync(join(root, 'capo1', 'workspace'))).toBe(true);
  });

  it('refuses ids that are not bot ids', () => {
    for (const id of ['', '../x', 'a/b', 'CAPS', 'x', 'a'.repeat(30)]) expect(botTermCwd(id)).toBeNull();
  });

  it('refuses a workspace that is a symlink out of botsRoot', () => {
    mkdirSync(join(root, 'evil1'));
    symlinkSync(dir, join(root, 'evil1', 'workspace'));
    expect(botTermCwd('evil1')).toBeNull();
  });
});

describe('helpers', () => {
  it('one term id per bot, valid as a tmux name', () => {
    expect(botTermId('capo1')).toBe('bot-capo1');
    expect(botTermId('a'.repeat(24))).toMatch(/^[a-zA-Z0-9_-]{1,32}$/);
  });

  it('abbreviates HOME', () => {
    expect(tildePath('/home/u/.cockpit/bots/x/workspace', '/home/u')).toBe('~/.cockpit/bots/x/workspace');
    expect(tildePath('/srv/bots/x', '/home/u')).toBe('/srv/bots/x');
    expect(tildePath('/home/user2/x', '/home/u')).toBe('/home/user2/x');
  });
});
