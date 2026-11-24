import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import {
  MEETING_LIMITS, applyAnswer, applyMinutes, coerceMeeting, failMeeting, isRunning, minutesPrompt, newMeeting, nextStep,
  round1Prompt, round2Prompt, validateMeetingInput, answerOf, type TeamMeeting,
} from '../shared/team-meeting';
import { isAgentModel } from '../shared/agents';
import { buildBotIdentity } from './team-prompt';
import { withFileLockAsync } from './ws/file-lock';
import { teamFile } from './team-log';

export function meetingsFile(): string {
  return process.env.COCKPIT_TEAM_MEETINGS ?? join(dirname(teamFile()), 'team-meetings.json');
}

export async function getMeetings(): Promise<TeamMeeting[]> {
  try {
    const j = JSON.parse(await readFile(meetingsFile(), 'utf8'));
    return Array.isArray(j) ? j.map(coerceMeeting).filter((m): m is TeamMeeting => m !== null) : [];
  } catch { return []; }
}

async function writeMeetings(list: TeamMeeting[]): Promise<void> {
  const file = meetingsFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const locked = () => withFileLockAsync(meetingsFile(), fn);
  const next = writeChain.then(locked, locked);
  writeChain = next.catch(() => {});
  return next;
}

export function saveMeeting(m: TeamMeeting): Promise<void> {
  return serialize(async () => {
    const all = await getMeetings();
    const i = all.findIndex((x) => x.id === m.id);
    if (i >= 0) all[i] = m; else all.push(m);
    all.sort((a, b) => a.createdAt - b.createdAt);
    await writeMeetings(all.slice(-MEETING_LIMITS.keep));
  });
}

export function hasRunningMeeting(): Promise<boolean> {
  return getMeetings().then((all) => all.some(isRunning));
}

// A meeting still running when the process starts lost its runner with the old one.
export function failInterruptedMeetings(now = Date.now()): Promise<TeamMeeting[]> {
  return serialize(async () => {
    const all = await getMeetings();
    const hit = all.filter(isRunning);
    if (!hit.length) return [];
    const failed = all.map((m) => (isRunning(m) ? failMeeting(m, 'interrompida por reinício', now) : m));
    await writeMeetings(failed);
    return failed.filter((m) => hit.some((h) => h.id === m.id));
  });
}

export interface MeetingDeps {
  ask: (system: string, prompt: string, model: string | undefined, key: string) => Promise<string>;
  getTeam: () => Promise<TeamBot[]>;
  isPaused: () => boolean;
  hasRoom: () => boolean;
  publish: (m: TeamMeeting) => void;
  now: () => number;
  newId: () => string;
}

export type StartResult = { ok: true; meeting: TeamMeeting; done: Promise<void> } | { ok: false; error: string };

let running = false;

export async function startMeeting(raw: unknown, deps: MeetingDeps): Promise<StartResult> {
  const team = await deps.getTeam();
  const v = validateMeetingInput(raw, team);
  if (!v.ok) return v;
  if (deps.isPaused()) return { ok: false, error: 'a equipe está pausada' };
  if (running || await hasRunningMeeting()) return { ok: false, error: 'já existe uma reunião em andamento' };
  if (!deps.hasRoom()) return { ok: false, error: 'sem vaga para rodar agora, tente em instantes' };
  running = true;
  const meeting = newMeeting(deps.newId(), v.input, deps.now());
  try {
    await saveMeeting(meeting);
  } catch (e) {
    running = false;
    return { ok: false, error: `não consegui salvar a reunião: ${e instanceof Error ? e.message : String(e)}` };
  }
  deps.publish(meeting);
  const done = runMeeting(meeting, deps).finally(() => { running = false; });
  return { ok: true, meeting, done };
}

async function commit(m: TeamMeeting, deps: MeetingDeps): Promise<TeamMeeting> {
  await saveMeeting(m);
  deps.publish(m);
  return m;
}

async function askWithRetry(bot: TeamBot, team: TeamBot[], prompt: string, key: string, deps: MeetingDeps): Promise<string> {
  const system = buildBotIdentity(bot, team);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (deps.isPaused()) return '';
    const text = (await deps.ask(system, prompt, bot.model, key).catch(() => '')).trim();
    if (text) return text;
  }
  return '';
}

export async function runMeeting(start: TeamMeeting, deps: MeetingDeps): Promise<void> {
  let m = start;
  try {
    while (m.status !== 'done' && m.status !== 'failed') {
      const step = nextStep(m);
      if (step.kind === 'none') break;
      const team = await deps.getTeam();
      const bot = team.find((b) => b.id === step.botId);
      const nameOf = (id: string) => team.find((b) => b.id === id)?.name ?? id;
      if (!bot) { m = await commit(failMeeting(m, 'um participante foi removido da equipe', deps.now()), deps); break; }
      if (isAgentModel(bot.model)) { m = await commit(failMeeting(m, `${bot.name} usa um agente externo`, deps.now()), deps); break; }
      if (deps.isPaused()) { m = await commit(failMeeting(m, 'a equipe foi pausada', deps.now()), deps); break; }
      const key = `meeting-${m.id}`;
      if (step.kind === 'minutes') {
        const text = await askWithRetry(bot, team, minutesPrompt(m.question, m.answers, nameOf), key, deps);
        m = await commit(text ? applyMinutes(m, text, deps.now()) : failMeeting(m, `${bot.name} não conseguiu escrever a ata`, deps.now()), deps);
        continue;
      }
      const prompt = step.round === 1
        ? round1Prompt(m.question)
        : round2Prompt(
          m.question,
          answerOf(m, step.botId, 1)?.text ?? '',
          m.answers.filter((a) => a.round === 1 && a.botId !== step.botId),
          nameOf,
        );
      const text = await askWithRetry(bot, team, prompt, key, deps);
      m = await commit(text ? applyAnswer(m, step.botId, step.round, text, deps.now()) : failMeeting(m, `${bot.name} não respondeu na rodada ${step.round}`, deps.now()), deps);
    }
  } catch (e) {
    await commit(failMeeting(m, `erro inesperado: ${e instanceof Error ? e.message : String(e)}`, deps.now()), deps).catch(() => {});
  }
}
