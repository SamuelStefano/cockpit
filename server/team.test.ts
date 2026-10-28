import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTeam, saveBot, deleteBot, bindBotSession } from './team';
import type { TeamBotInput } from '../shared/protocol';

const bot = (id: string, over: Partial<TeamBotInput> = {}): TeamBotInput => ({
  id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full', ...over,
});
const SID = '11111111-1111-1111-1111-111111111111';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-team-')); process.env.COCKPIT_TEAM = join(dir, 'team.json'); });
afterEach(() => { delete process.env.COCKPIT_TEAM; rmSync(dir, { recursive: true, force: true }); });

describe('team store', () => {
  it('creates, edits and deletes, with server-owned timestamps', async () => {
    await saveBot(bot('capo1', { label: 'coo' }), 100);
    let r = await saveBot(bot('capo1', { label: 'ceo' }), 200);
    expect(r.ok && r.bots).toEqual([expect.objectContaining({ id: 'capo1', label: 'ceo', createdAt: 100, updatedAt: 200 })]);
    await saveBot(bot('lead1'), 300);
    expect((await getTeam()).map((b) => b.id)).toEqual(['capo1', 'lead1']);
    expect((await deleteBot('lead1')).map((b) => b.id)).toEqual(['capo1']);
    r = await saveBot(bot('capo1'), 400);
    expect(r.ok && r.bots[0].createdAt).toBe(100);
  });

  it('keeps exactly one primary', async () => {
    await saveBot(bot('aaaa1'));
    expect((await getTeam())[0].primary).toBe(true);
    await saveBot(bot('bbbb1', { primary: true }));
    const team = await getTeam();
    expect(team.filter((b) => b.primary).map((b) => b.id)).toEqual(['bbbb1']);
    await saveBot(bot('bbbb1'));
    expect((await getTeam()).filter((b) => b.primary).map((b) => b.id)).toEqual(['aaaa1']);
    await deleteBot('aaaa1');
    expect((await getTeam())[0].primary).toBe(true);
  });

  it('refuses a parentId cycle and an unknown parent', async () => {
    await saveBot(bot('capo1'));
    await saveBot(bot('lead1', { parentId: 'capo1' }));
    await saveBot(bot('kid11', { parentId: 'lead1' }));
    expect(await saveBot(bot('capo1', { parentId: 'kid11' }))).toEqual({ ok: false, error: 'essa chefia formaria um ciclo' });
    expect(await saveBot(bot('lead1', { parentId: 'nope1' }))).toEqual({ ok: false, error: 'chefe não encontrado' });
  });

  it('orphans the children of a deleted bot', async () => {
    await saveBot(bot('capo1'));
    await saveBot(bot('lead1', { parentId: 'capo1' }));
    const rest = await deleteBot('capo1');
    expect(rest[0].parentId).toBeUndefined();
  });

  it('binds the session once, and a browser save cannot rewind it', async () => {
    await saveBot(bot('capo1'));
    expect(await bindBotSession('capo1', SID)).not.toBeNull();
    expect(await bindBotSession('capo1', SID)).toBeNull();
    expect(await bindBotSession('ghost', SID)).toBeNull();
    await saveBot({ ...bot('capo1'), sessionId: 'forged' } as TeamBotInput);
    expect((await getTeam())[0].sessionId).toBe(SID);
  });

  it('concurrent saves never lose a write', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `bot${String(i).padStart(2, '0')}`);
    await Promise.all(ids.map((id) => saveBot(bot(id))));
    const team = await getTeam();
    expect(team.map((b) => b.id).sort()).toEqual(ids);
    expect(team.filter((b) => b.primary)).toHaveLength(1);
    expect(() => JSON.parse(readFileSync(process.env.COCKPIT_TEAM!, 'utf8'))).not.toThrow();
  });
});

describe('team store: files written before the hierarchy fields', () => {
  it('loads an old-format team.json unchanged and keeps it through a save', async () => {
    const old = [{ id: 'aaaa1', name: 'Lia', label: 'coo', instructions: 'x', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 1, updatedAt: 2 }];
    writeFileSync(process.env.COCKPIT_TEAM!, JSON.stringify(old));
    expect(await getTeam()).toEqual(old);
    const r = await saveBot(bot('bbbb1', { parentId: 'aaaa1' }), 5);
    expect(r.ok && r.bots[0]).toEqual(expect.objectContaining({ id: 'aaaa1', label: 'coo', createdAt: 1 }));
    expect(r.ok && r.bots[1].parentId).toBe('aaaa1');
  });
});

describe('team store access fields', () => {
  it('loads a file written before skills/permissions existed, unchanged', async () => {
    const old = [{ ...bot('capo1'), createdAt: 1, updatedAt: 1, primary: true }];
    writeFileSync(process.env.COCKPIT_TEAM!, JSON.stringify(old));
    expect(await getTeam()).toEqual(old);
  });
  it('persists skills and permissions', async () => {
    await saveBot(bot('capo1', { skills: ['a'], permissions: { read: true, write: false, net: true } }), 1);
    expect((await getTeam())[0]).toMatchObject({ skills: ['a'], permissions: { read: true, write: false, net: true } });
  });
});
