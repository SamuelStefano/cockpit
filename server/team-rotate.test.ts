import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TeamBotInput } from '../shared/protocol';
import { bindBotSession, getTeam, saveBot } from './team';
import { readTeamLog } from './team-log';
import { botTurnParams } from './team-prompt';
import { rotateBot } from './team-rotate';

const bot = (id: string): TeamBotInput => ({ id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full' });
const OLD = '11111111-1111-1111-1111-111111111111';
const NEW = '22222222-2222-2222-2222-222222222222';
let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'deck-rotate-'));
  mkdirSync(join(dir, 'handoffs'));
  Object.assign(process.env, { COCKPIT_TEAM: join(dir, 'team.json'), COCKPIT_TEAM_LOG: join(dir, 'log.jsonl'), COCKPIT_HANDOFFS: join(dir, 'handoffs') });
  await saveBot(bot('vegeta1'));
  await bindBotSession('vegeta1', OLD);
});
afterEach(() => {
  for (const k of ['COCKPIT_TEAM', 'COCKPIT_TEAM_LOG', 'COCKPIT_HANDOFFS']) delete process.env[k];
  rmSync(dir, { recursive: true, force: true });
});

const writeHandoff = (text: string) => writeFileSync(join(dir, 'handoffs', 'vegeta1.md'), text);
const idle = () => false;

describe('rotateBot', () => {
  it('refuses a busy bot and leaves the session alone', async () => {
    writeHandoff('state: x');
    const r = await rotateBot('vegeta1', () => true);
    expect(r).toEqual({ ok: false, error: 'bot ocupado' });
    expect((await getTeam())[0].sessionId).toBe(OLD);
  });

  it('refuses without a handoff file', async () => {
    const r = await rotateBot('vegeta1', idle);
    expect(r.ok).toBe(false);
    expect((await getTeam())[0].sessionId).toBe(OLD);
  });

  it('refuses a handoff over 500 words', async () => {
    writeHandoff('word '.repeat(501));
    const r = await rotateBot('vegeta1', idle);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('501') });
    expect((await getTeam())[0].sessionId).toBe(OLD);
  });

  it('refuses an unknown bot', async () => {
    expect(await rotateBot('nobody', idle)).toMatchObject({ ok: false });
  });

  it('clears the session, logs it, and the next turn skips --resume and carries the handoff', async () => {
    writeHandoff('Estado: V1 pronta. Próximo: UI do card.');
    const r = await rotateBot('vegeta1', idle, 500);
    expect(r).toMatchObject({ ok: true, words: 7 });
    const team = await getTeam();
    expect(team[0].sessionId).toBeUndefined();
    const turn = botTurnParams(team, 'bot-vegeta1', OLD)!;
    expect(turn.resumeId).toBeUndefined();
    expect(turn.appendSystemPrompt).toContain('Estado: V1 pronta. Próximo: UI do card.');
    const log = await readTeamLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ from: 'vegeta1', to: 'vegeta1', status: 'delivered' });
  });

  it('once the new session binds, turns resume it and drop the handoff block', async () => {
    writeHandoff('Estado: V1 pronta.');
    await rotateBot('vegeta1', idle);
    await bindBotSession('vegeta1', NEW);
    const team = await getTeam();
    expect(team[0].rotatedAt).toBeUndefined();
    const turn = botTurnParams(team, 'bot-vegeta1')!;
    expect(turn.resumeId).toBe(NEW);
    expect(turn.appendSystemPrompt).not.toContain('Estado: V1 pronta.');
  });

  it('a team.json save from the browser does not drop a pending rotation', async () => {
    writeHandoff('Estado.');
    await rotateBot('vegeta1', idle);
    await saveBot({ ...bot('vegeta1'), label: 'dev' });
    expect((await getTeam())[0].rotatedAt).toBeDefined();
  });
});

describe('old session after rotate', () => {
  it('keeps the old id and still speaks as the bot, resuming the current session', async () => {
    writeHandoff('state: x');
    await rotateBot('vegeta1', idle);
    expect((await getTeam())[0].previousSessionIds).toEqual([OLD]);
    await bindBotSession('vegeta1', NEW);
    const team = await getTeam();
    expect(team[0].previousSessionIds).toEqual([OLD]);
    expect(botTurnParams(team, 'k1', OLD)).toMatchObject({ botId: 'vegeta1', resumeId: NEW });
  });
});
