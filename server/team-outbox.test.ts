import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import { MAX_TEAM_MSGS_PER_HOUR } from '../shared/team-messages';

let dir = '';
let outbox = '';
function fresh() {
  dir = mkdtempSync(join(tmpdir(), 'deck-team-outbox-'));
  outbox = join(dir, 'outbox');
  mkdirSync(outbox, { recursive: true });
  process.env.COCKPIT_TEAM_OUTBOX = outbox;
  process.env.COCKPIT_TEAM_LOG = join(dir, 'log.jsonl');
  process.env.COCKPIT_TEAM_PAUSE = join(dir, 'paused.json');
}
fresh();

const { claimOutbox, processClaimed, recoverStale, drainOutbox, parseSpool } = await import('./team-outbox');
const { readTeamLog, setTeamPaused, appendTeamLog } = await import('./team-log');

const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 1, updatedAt: 1 });
const team = [bot('lead1', 'lead'), bot('ativ1', 'ativ')];
let n = 0;
function spool(over: Record<string, unknown> = {}): string {
  const id = `mtest${(n++).toString().padStart(4, '0')}`;
  writeFileSync(join(outbox, `${id}.json`), JSON.stringify({ id, from: 'lead1', to: 'ativ1', text: 'oi', hop: 1, ts: 1, ...over }));
  return id;
}
const deps = (deliver = vi.fn(async () => 'delivered' as const)) => ({ getTeam: async () => team, deliver, emit: vi.fn(), now: () => 1_000_000 });

beforeEach(() => { fresh(); });

describe('outbox claim', () => {
  it('two concurrent claimers take each file exactly once', async () => {
    const ids = Array.from({ length: 40 }, () => spool());
    const [a, b] = await Promise.all([claimOutbox(outbox, 1001), claimOutbox(outbox, 1002)]);
    const claimed = [...a, ...b].map((p) => /(mtest\d+)\./.exec(p)![1]).sort();
    expect(claimed).toEqual(ids.sort());
    expect(readdirSync(outbox).filter((f) => f.endsWith('.json'))).toEqual([]);
  });

  it('two processes draining at once deliver each message once', async () => {
    for (let i = 0; i < 10; i++) spool();
    const deliver = vi.fn(async () => 'delivered' as const);
    const d = deps(deliver);
    const [a, b] = await Promise.all([claimOutbox(outbox, 2001), claimOutbox(outbox, 2002)]);
    await Promise.all([...a.map((p) => processClaimed(p, d)), ...b.map((p) => processClaimed(p, d))]);
    expect(deliver).toHaveBeenCalledTimes(10);
    expect((await readTeamLog()).map((m) => m.status)).toEqual(Array(10).fill('delivered'));
  });

  it('ignores tmp files the MCP is still writing', async () => {
    writeFileSync(join(outbox, '.mtest9999.tmp'), '{');
    expect(await claimOutbox(outbox)).toEqual([]);
  });
});

describe('processClaimed', () => {
  it('delivers, logs and emits', async () => {
    const id = spool({ text: 'métricas do dia 1' });
    const d = deps();
    await drainOutbox(d, outbox);
    expect(d.deliver).toHaveBeenCalledWith(expect.objectContaining({ id, from: 'lead1', to: 'ativ1', hop: 1 }), team);
    const [entry] = await readTeamLog();
    expect(entry).toMatchObject({ id, from: 'lead1', to: 'ativ1', text: 'métricas do dia 1', status: 'delivered', ts: 1_000_000 });
    expect(d.emit).toHaveBeenCalledWith(entry);
    expect(existsSync(join(outbox, 'processing', `${id}.${process.pid}.json`))).toBe(false);
  });

  it('logs the queue outcome when the recipient is busy', async () => {
    spool();
    await drainOutbox(deps(vi.fn(async () => 'queued' as const)), outbox);
    expect((await readTeamLog())[0].status).toBe('queued');
  });

  it('blocks hop 6 without delivering', async () => {
    spool({ hop: 6 });
    const d = deps();
    await drainOutbox(d, outbox);
    expect(d.deliver).not.toHaveBeenCalled();
    expect((await readTeamLog())[0]).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/cadeia/), hop: 6 });
  });

  it('blocks past the hourly budget of the sender', async () => {
    for (let i = 0; i < MAX_TEAM_MSGS_PER_HOUR; i++) {
      await appendTeamLog({ id: `mold${String(i).padStart(4, '0')}`, from: 'lead1', to: 'ativ1', text: 'x', ts: 1_000_000 - 60_000, status: 'delivered', hop: 1 });
    }
    await appendTeamLog({ id: 'moldblocked', from: 'lead1', to: 'ativ1', text: 'x', ts: 1_000_000, status: 'blocked', hop: 1 });
    spool();
    const d = deps();
    await drainOutbox(d, outbox);
    expect(d.deliver).not.toHaveBeenCalled();
    expect((await readTeamLog()).at(-1)).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/por hora/) });
  });

  it('does not count messages older than an hour', async () => {
    for (let i = 0; i < MAX_TEAM_MSGS_PER_HOUR; i++) {
      await appendTeamLog({ id: `mold${String(i).padStart(4, '0')}`, from: 'lead1', to: 'ativ1', text: 'x', ts: 1_000_000 - 3_700_000, status: 'delivered', hop: 1 });
    }
    spool();
    const d = deps();
    await drainOutbox(d, outbox);
    expect(d.deliver).toHaveBeenCalledTimes(1);
  });

  it('blocks everything while the team is paused', async () => {
    await setTeamPaused(true);
    spool();
    const d = deps();
    await drainOutbox(d, outbox);
    expect(d.deliver).not.toHaveBeenCalled();
    expect((await readTeamLog())[0]).toMatchObject({ status: 'blocked', reason: 'equipe pausada' });
  });

  it('blocks a message to a bot outside the team', async () => {
    spool({ to: 'ghost1' });
    const d = deps();
    await drainOutbox(d, outbox);
    expect(d.deliver).not.toHaveBeenCalled();
    expect((await readTeamLog())[0]).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/destinatário/) });
  });

  it('records a delivery that threw as failed', async () => {
    spool();
    await drainOutbox(deps(vi.fn(async () => { throw new Error('boom'); })), outbox);
    expect((await readTeamLog())[0]).toMatchObject({ status: 'failed', reason: 'boom' });
  });

  it('never handles the same id twice', async () => {
    const id = spool();
    const d = deps();
    await drainOutbox(d, outbox);
    spool({ id });
    await drainOutbox(d, outbox);
    expect(d.deliver).toHaveBeenCalledTimes(1);
    expect(await readTeamLog()).toHaveLength(1);
  });
});

describe('recoverStale', () => {
  const DEAD_PID = 2 ** 22 + 12345;
  it('hands an unlogged claim of a dead process back to the outbox', async () => {
    mkdirSync(join(outbox, 'processing'), { recursive: true });
    writeFileSync(join(outbox, 'processing', `mtest7777.${DEAD_PID}.json`), '{}');
    await recoverStale(outbox);
    expect(existsSync(join(outbox, 'mtest7777.json'))).toBe(true);
  });

  it('drops a claim the dead process had already logged', async () => {
    mkdirSync(join(outbox, 'processing'), { recursive: true });
    writeFileSync(join(outbox, 'processing', `mtest8888.${DEAD_PID}.json`), '{}');
    await appendTeamLog({ id: 'mtest8888', from: 'a', to: 'b', text: 'x', ts: 1, status: 'delivered', hop: 1 });
    await recoverStale(outbox);
    expect(readdirSync(join(outbox, 'processing'))).toEqual([]);
    expect(existsSync(join(outbox, 'mtest8888.json'))).toBe(false);
  });
});

describe('parseSpool', () => {
  it('rejects a bad id and defaults a missing hop to 1', () => {
    expect(parseSpool(JSON.stringify({ id: '../x', from: 'a', to: 'b', text: 'x' }))).toBeNull();
    expect(parseSpool(JSON.stringify({ id: 'mabcdef1', from: 'a', to: 'b', text: 'x' }))?.hop).toBe(1);
  });
});
