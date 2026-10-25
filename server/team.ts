import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { TeamBot, TeamBotInput } from '../shared/protocol';
import { MAX_BOTS, wouldCycle } from '../shared/team';
import { withFileLockAsync } from './ws/file-lock';
import { teamFile } from './team-log';


export async function getTeam(): Promise<TeamBot[]> {
  try { const j = JSON.parse(await readFile(teamFile(), 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; }
}

async function writeTeam(list: TeamBot[]): Promise<void> {
  const file = teamFile();
  await mkdir(dirname(file), { recursive: true });
  // Per-process random tmp name: both backend processes write this file, and a
  // shared `.tmp` let one rename the other's half-written file into place.
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

// In-process chain orders this process; the file lock orders it against the other.
let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const locked = () => withFileLockAsync(teamFile(), fn);
  const next = writeChain.then(locked, locked);
  writeChain = next.catch(() => {});
  return next;
}

export type SaveResult = { ok: true; bots: TeamBot[] } | { ok: false; error: string };

export function saveBot(input: TeamBotInput, now = Date.now()): Promise<SaveResult> {
  return serialize(async (): Promise<SaveResult> => {
    const all = await getTeam();
    const i = all.findIndex((b) => b.id === input.id);
    if (i < 0 && all.length >= MAX_BOTS) return { ok: false, error: `a equipe já tem ${MAX_BOTS} bots` };
    if (input.parentId && !all.some((b) => b.id === input.parentId)) return { ok: false, error: 'chefe não encontrado' };
    if (wouldCycle(all, input.id, input.parentId)) return { ok: false, error: 'essa chefia formaria um ciclo' };
    const prev = i >= 0 ? all[i] : undefined;
    // sessionId and createdAt are the server's: a stale browser copy must never
    // rewind the bot's thread to an older session.
    const bot: TeamBot = { ...input, createdAt: prev?.createdAt ?? now, updatedAt: now };
    if (prev?.sessionId) bot.sessionId = prev.sessionId;
    if (bot.primary) for (const b of all) if (b.id !== bot.id) delete b.primary;
    if (i >= 0) all[i] = bot; else all.push(bot);
    // Exactly one primary while the team is non-empty: the roster's lead card and
    // fatia C's "who talks to the human" both assume it exists.
    if (!all.some((b) => b.primary)) all[0].primary = true;
    await writeTeam(all);
    return { ok: true, bots: all };
  });
}

export function deleteBot(id: string, now = Date.now()): Promise<TeamBot[]> {
  return serialize(async () => {
    const all = await getTeam();
    const gone = all.find((b) => b.id === id);
    const rest = all.filter((b) => b.id !== id);
    for (const b of rest) if (b.parentId === id) { delete b.parentId; b.updatedAt = now; }
    if (gone && rest.length && !rest.some((b) => b.primary)) rest[0].primary = true;
    await writeTeam(rest);
    return rest;
  });
}

// Binds the session the bot's turn actually ran in. Returns the new list only
// when something changed, so the caller broadcasts once per real rebinding.
export function bindBotSession(id: string, sessionId: string, now = Date.now()): Promise<TeamBot[] | null> {
  return serialize(async () => {
    const all = await getTeam();
    const bot = all.find((b) => b.id === id);
    if (!bot || bot.sessionId === sessionId) return null;
    bot.sessionId = sessionId;
    bot.updatedAt = now;
    await writeTeam(all);
    return all;
  });
}
