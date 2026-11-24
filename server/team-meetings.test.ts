import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import type { TeamMeeting } from '../shared/team-meeting';
import { failInterruptedMeetings, getMeetings, saveMeeting, startMeeting, type MeetingDeps } from './team-meetings';

const bot = (id: string, name: string, over: Partial<TeamBot> = {}): TeamBot => ({
  id, name, label: 'l', instructions: `instr ${name}`, mascot: { shape: 'drop', color: '#fff' }, profile: 'restricted', createdAt: 1, updatedAt: 1, ...over,
});
const team = [bot('a1', 'Ana', { primary: true, model: 'opus' }), bot('b2', 'Beto'), bot('c3', 'Caio'), bot('g7', 'Grok', { model: 'agent:grok' })];
const input = { question: 'Migrar?', participantIds: ['a1', 'b2'], moderatorId: 'c3' };

let dir: string;
let published: TeamMeeting[];
let asked: { system: string; prompt: string; model: string | undefined }[];

function deps(over: Partial<MeetingDeps> = {}): MeetingDeps {
  let n = 0;
  return {
    ask: async (system, prompt, model) => { asked.push({ system, prompt, model }); return `reply ${asked.length}`; },
    getTeam: async () => team,
    isPaused: () => false,
    hasRoom: () => true,
    publish: (m) => { published.push(JSON.parse(JSON.stringify(m))); },
    now: () => 100 + n++,
    newId: () => 'm1',
    ...over,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mt-'));
  process.env.COCKPIT_TEAM_MEETINGS = join(dir, 'team-meetings.json');
  published = [];
  asked = [];
});
afterEach(() => { delete process.env.COCKPIT_TEAM_MEETINGS; rmSync(dir, { recursive: true, force: true }); });

async function run(d: MeetingDeps) {
  const r = await startMeeting(input, d);
  if (!r.ok) throw new Error(r.error);
  await r.done;
  return (await getMeetings())[0];
}

describe('startMeeting', () => {
  it('runs round 1, round 2 and the minutes strictly in sequence', async () => {
    let live = 0; let peak = 0;
    const m = await run(deps({
      ask: async (system, prompt, model) => {
        live++; peak = Math.max(peak, live);
        await new Promise((r) => setTimeout(r, 2));
        live--;
        asked.push({ system, prompt, model });
        return `reply ${asked.length}`;
      },
    }));
    expect(peak).toBe(1);
    expect(m.status).toBe('done');
    expect(asked).toHaveLength(5);
    expect(m.answers.map((a) => `${a.botId}/${a.round}`)).toEqual(['a1/1', 'b2/1', 'a1/2', 'b2/2']);
    expect(m.minutes).toBe('reply 5');
  });

  it('speaks as each bot with its own model and identity', async () => {
    await run(deps());
    expect(asked[0].model).toBe('opus');
    expect(asked[0].system).toContain('instr Ana');
    expect(asked[1].model).toBeUndefined();
    expect(asked[1].system).toContain('instr Beto');
    expect(asked[4].system).toContain('instr Caio');
  });

  it('keeps round 1 blind: a round-1 prompt never carries another answer', async () => {
    await run(deps());
    expect(asked[1].prompt).not.toContain('reply 1');
    expect(asked[2].prompt).toContain('reply 2');
    expect(asked[2].prompt).toContain('Beto');
  });

  it('never publishes round-1 text while round 1 is open (visible form)', async () => {
    const { visibleMeeting } = await import('../shared/team-meeting');
    await run(deps());
    const open = published.filter((m) => m.status === 'round1');
    expect(open.length).toBeGreaterThan(0);
    for (const m of open) expect(JSON.stringify(visibleMeeting(m).answers.map((a) => a.text))).not.toContain('reply');
  });

  it('persists after every answer and publishes each change', async () => {
    await run(deps());
    expect(published.map((m) => m.answers.length)).toEqual([0, 1, 2, 3, 4, 4]);
    expect(published.at(-1)?.status).toBe('done');
  });

  it('retries once, then succeeds', async () => {
    let calls = 0;
    const m = await run(deps({ ask: async () => (++calls === 1 ? '' : 'ok') }));
    expect(m.status).toBe('done');
    expect(calls).toBe(6);
  });

  it('fails after the retry and keeps what was collected', async () => {
    let calls = 0;
    const m = await run(deps({ ask: async () => (++calls <= 2 ? 'fine' : '') }));
    expect(m.status).toBe('failed');
    expect(m.error).toContain('Caio'.length ? 'não respondeu' : '');
    expect(m.answers).toHaveLength(2);
    expect(calls).toBe(4);
  });

  it('treats a throwing call as a failed attempt', async () => {
    const m = await run(deps({ ask: async () => { throw new Error('boom'); } }));
    expect(m.status).toBe('failed');
    expect(m.answers).toHaveLength(0);
  });

  it('refuses while paused, without a slot, or with an external agent', async () => {
    expect(await startMeeting(input, deps({ isPaused: () => true }))).toEqual({ ok: false, error: 'a equipe está pausada' });
    expect((await startMeeting(input, deps({ hasRoom: () => false }))).ok).toBe(false);
    const ext = await startMeeting({ ...input, participantIds: ['a1', 'g7'] }, deps());
    expect(ext).toEqual({ ok: false, error: 'Grok usa um agente externo e não participa de reuniões' });
    expect(await getMeetings()).toEqual([]);
    expect(asked).toHaveLength(0);
  });

  it('refuses a second meeting while one runs', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const first = await startMeeting(input, deps({ ask: async () => { await gate; return 'x'; } }));
    expect(first.ok).toBe(true);
    const second = await startMeeting(input, deps());
    expect(second).toEqual({ ok: false, error: 'já existe uma reunião em andamento' });
    release();
    if (first.ok) await first.done;
    const third = await startMeeting(input, deps());
    expect(third.ok).toBe(true);
    if (third.ok) await third.done;
  });

  it('fails the meeting when the team is paused mid-run', async () => {
    let paused = false;
    const m = await run(deps({ ask: async () => { paused = true; return 'x'; }, isPaused: () => paused }));
    expect(m.status).toBe('failed');
    expect(m.error).toBe('a equipe foi pausada');
  });
});

describe('store', () => {
  const mk = (i: number): TeamMeeting => ({ id: `m${i}`, question: 'q', participantIds: ['a1', 'b2'], moderatorId: 'c3', status: 'done', answers: [], createdAt: i, updatedAt: i });

  it('keeps the newest 50', async () => {
    for (let i = 0; i < 53; i++) await saveMeeting(mk(i));
    const all = await getMeetings();
    expect(all).toHaveLength(50);
    expect(all[0].id).toBe('m3');
  });

  it('marks running meetings failed on start, leaving finished ones', async () => {
    await saveMeeting({ ...mk(1), status: 'round2' });
    await saveMeeting(mk(2));
    const failed = await failInterruptedMeetings(9);
    expect(failed.map((m) => m.id)).toEqual(['m1']);
    const all = await getMeetings();
    expect(all.find((m) => m.id === 'm1')).toMatchObject({ status: 'failed', error: 'interrompida por reinício' });
    expect(all.find((m) => m.id === 'm2')?.status).toBe('done');
    expect(await failInterruptedMeetings(10)).toEqual([]);
  });
});
