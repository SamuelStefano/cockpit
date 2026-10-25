import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'deck-custom-'));
const bin = join(root, 'bin');

vi.mock('node:os', async (orig) => {
  const os = await orig<typeof import('node:os')>();
  return { ...os, homedir: () => root };
});
vi.mock('../config', () => ({ CONFIG: { workdir: root, projectsDir: join(root, 'projects') } }));

let mod: typeof import('./custom-agent');

beforeAll(async () => {
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'my-acp'), '#!/bin/sh\n');
  chmodSync(join(bin, 'my-acp'), 0o755);
  writeFileSync(join(bin, 'not-exec'), '#!/bin/sh\n');
  chmodSync(join(bin, 'not-exec'), 0o644);
  mod = await import('./custom-agent');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const base = { id: 'mine', name: 'Mine', command: 'my-acp', args: ['--acp'] };

describe('checkCustomAgent', () => {
  it('accepts a bare command found on the PATH and reports where', async () => {
    const r = await mod.checkCustomAgent({ ...base, install: ' npm i -g my-acp ', login: '' }, bin);
    expect(r).toEqual({ ok: true, resolved: join(bin, 'my-acp'), agent: { id: 'mine', name: 'Mine', command: 'my-acp', args: ['--acp'], install: 'npm i -g my-acp' } });
  });

  it('accepts an absolute path that exists and is executable', async () => {
    const r = await mod.checkCustomAgent({ ...base, command: join(bin, 'my-acp') }, '');
    expect(r.ok).toBe(true);
  });

  it('refuses a command that is not on the box', async () => {
    const r = await mod.checkCustomAgent({ ...base, command: 'nope-acp' }, bin);
    expect(r).toMatchObject({ ok: false, field: 'command' });
    expect(!r.ok && r.message).toMatch(/não está instalado/);
  });

  it('refuses a file without the exec bit and a directory', async () => {
    expect(await mod.checkCustomAgent({ ...base, command: 'not-exec' }, bin)).toMatchObject({ ok: false, field: 'command' });
    expect(await mod.checkCustomAgent({ ...base, command: bin }, '')).toMatchObject({ ok: false, field: 'command' });
  });

  it.each([
    'my-acp; rm -rf /', 'my-acp --acp', '$(whoami)', '`id`', 'a|b', '-rf', '../bin/my-acp', '~/my-acp', 'my*',
    '/usr/bin/../bin/sh', '/tmp/a b', '',
  ])('refuses shell-shaped command %j', async (command) => {
    expect(await mod.checkCustomAgent({ ...base, command }, bin)).toMatchObject({ ok: false, field: 'command' });
  });

  it.each([['a b'], ['$HOME'], ['x;y'], ["'q'"], ['a|b'], ['>out'], ['*'], [''], ['a\nb']])('refuses arg %j', async (arg) => {
    expect(await mod.checkCustomAgent({ ...base, args: [arg] }, bin)).toMatchObject({ ok: false, field: 'args' });
  });

  it('wants args as an array of at most 16 strings', async () => {
    expect(await mod.checkCustomAgent({ ...base, args: '--acp' }, bin)).toMatchObject({ ok: false, field: 'args' });
    expect(await mod.checkCustomAgent({ ...base, args: [1] }, bin)).toMatchObject({ ok: false, field: 'args' });
    expect(await mod.checkCustomAgent({ ...base, args: Array(17).fill('x') }, bin)).toMatchObject({ ok: false, field: 'args' });
  });

  it('wants a slug id that is not a preset', async () => {
    for (const id of ['Mine', '1abc', 'a_b', 'x'.repeat(33), '', 7]) {
      expect(await mod.checkCustomAgent({ ...base, id }, bin)).toMatchObject({ ok: false, field: 'id' });
    }
    expect(await mod.checkCustomAgent({ ...base, id: 'grok' }, bin)).toMatchObject({ ok: false, field: 'id', message: expect.stringMatching(/agente pronto/) });
  });

  it('wants a short one-line name and one-line setup commands', async () => {
    expect(await mod.checkCustomAgent({ ...base, name: ' ' }, bin)).toMatchObject({ ok: false, field: 'name' });
    expect(await mod.checkCustomAgent({ ...base, name: 'x'.repeat(49) }, bin)).toMatchObject({ ok: false, field: 'name' });
    expect(await mod.checkCustomAgent({ ...base, install: 'a\nb' }, bin)).toMatchObject({ ok: false, field: 'install' });
    expect(await mod.checkCustomAgent({ ...base, login: 'x\x1b[2J' }, bin)).toMatchObject({ ok: false, field: 'login' });
    expect(await mod.checkCustomAgent({ ...base, login: 5 }, bin)).toMatchObject({ ok: false, field: 'login' });
  });
});

describe('saveCustomAgent', () => {
  it('writes a valid agent with its setup commands to agents.json', async () => {
    const r = await mod.saveCustomAgent({ ...base, command: join(bin, 'my-acp'), login: 'my-acp login' });
    expect(r.ok).toBe(true);
    const file = JSON.parse(readFileSync(join(root, '.deck-agent', 'agents.json'), 'utf8'));
    expect(file.agents).toEqual([{ id: 'mine', name: 'Mine', command: join(bin, 'my-acp'), args: ['--acp'], login: 'my-acp login' }]);
  });

  it('writes nothing when the check fails', async () => {
    const r = await mod.saveCustomAgent({ ...base, id: 'other', command: 'sh -c id' });
    expect(r).toMatchObject({ ok: false, field: 'command' });
    const file = JSON.parse(readFileSync(join(root, '.deck-agent', 'agents.json'), 'utf8'));
    expect(file.agents.map((a: { id: string }) => a.id)).toEqual(['mine']);
  });
});

describe('probeDraft', () => {
  it('never spawns a draft that fails the check', async () => {
    const r = await mod.probeDraft({ ...base, command: 'my-acp && id' });
    expect(r).toMatchObject({ status: 'error', field: 'command' });
  });
});

describe('customAgentDenial', () => {
  it('lets only an admin connection on the owner box through', () => {
    expect(mod.customAgentDenial('admin', true)).toBeNull();
    expect(mod.customAgentDenial('student', true)).toMatch(/root/);
    expect(mod.customAgentDenial(undefined, true)).toMatch(/root/);
    expect(mod.customAgentDenial('admin', false)).toMatch(/agents\.json/);
  });
});
