import { randomBytes } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  VILLAGE_DEFAULT_DAILY_CAP, VILLAGE_EVENTS_CAP, VILLAGE_TURN_DAYS, clampDailyCap,
  type VillageEvent, type VillageState,
} from '../../shared/village';
import { withFileLockAsync } from '../ws/file-lock';

export function villageFile(): string {
  return process.env.COCKPIT_VILLAGE ?? join(homedir(), '.cockpit', 'village.json');
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BRT_OFFSET_MS = 3 * 3_600_000;

export function brtDate(now: number): string {
  return new Date(now - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

export function emptyState(): VillageState {
  return { enabled: false, dailyCap: VILLAGE_DEFAULT_DAILY_CAP, turns: {}, events: [] };
}

export function sanitizeState(raw: unknown): VillageState {
  const r = raw as Partial<VillageState> | null | undefined;
  const out = emptyState();
  if (!r || typeof r !== 'object') return out;
  out.enabled = r.enabled === true;
  out.dailyCap = clampDailyCap(r.dailyCap) ?? VILLAGE_DEFAULT_DAILY_CAP;
  if (r.turns && typeof r.turns === 'object') {
    for (const [day, bots] of Object.entries(r.turns)) {
      if (!DAY_RE.test(day) || !bots || typeof bots !== 'object') continue;
      const row: Record<string, number> = {};
      for (const [id, n] of Object.entries(bots)) if (typeof n === 'number' && Number.isInteger(n) && n > 0) row[id] = n;
      out.turns[day] = row;
    }
  }
  if (Array.isArray(r.events)) {
    for (const e of r.events as Partial<VillageEvent>[]) {
      if (!e || (e.type !== 'claim' && e.type !== 'release' && e.type !== 'skip') || typeof e.botId !== 'string' || typeof e.taskId !== 'string' || typeof e.at !== 'number') continue;
      out.events.push({ at: e.at, type: e.type, botId: e.botId, taskId: e.taskId, ...(typeof e.reason === 'string' ? { reason: e.reason.slice(0, 200) } : {}) });
    }
    out.events = out.events.slice(-VILLAGE_EVENTS_CAP);
  }
  return out;
}

export function pruneTurns(turns: VillageState['turns']): VillageState['turns'] {
  const out: VillageState['turns'] = {};
  for (const day of Object.keys(turns).sort().slice(-VILLAGE_TURN_DAYS)) out[day] = turns[day];
  return out;
}

export function turnsToday(state: VillageState, botId: string, now: number): number {
  return state.turns[brtDate(now)]?.[botId] ?? 0;
}

export async function readVillage(): Promise<VillageState> {
  try { return sanitizeState(JSON.parse(await readFile(villageFile(), 'utf8'))); } catch { return emptyState(); }
}

export function withVillageLock<T>(fn: () => Promise<T>): Promise<T> {
  return withFileLockAsync(villageFile(), fn);
}

async function write(state: VillageState): Promise<void> {
  const f = villageFile();
  await mkdir(dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(state), 'utf8');
  await rename(tmp, f);
}

export function updateVillage(fn: (s: VillageState) => VillageState): Promise<VillageState> {
  return withVillageLock(async () => {
    const next = fn(await readVillage());
    next.events = next.events.slice(-VILLAGE_EVENTS_CAP);
    await write(next);
    return next;
  });
}

export const recordEvent = (s: VillageState, e: VillageEvent): VillageState => ({ ...s, events: [...s.events, e].slice(-VILLAGE_EVENTS_CAP) });

export function addTurn(s: VillageState, botId: string, now: number): VillageState {
  const day = brtDate(now);
  const turns = pruneTurns({ ...s.turns, [day]: { ...s.turns[day], [botId]: (s.turns[day]?.[botId] ?? 0) + 1 } });
  return { ...s, turns };
}

export const setVillageSettings = (p: { enabled?: boolean; dailyCap?: number }) =>
  updateVillage((s) => ({ ...s, ...(p.enabled !== undefined ? { enabled: p.enabled } : {}), ...(p.dailyCap !== undefined ? { dailyCap: p.dailyCap } : {}) }));

export function villageLogFile(): string {
  return process.env.COCKPIT_VILLAGE_LOG ?? join(homedir(), '.cockpit', 'village-log.jsonl');
}

export interface VillageLogEntry { at: number; event: 'claim' | 'release' | 'skip' | 'ready' | 'ready refused' | 'done'; taskId: string; botId?: string; reason?: string }

export async function appendVillageLog(e: VillageLogEntry): Promise<void> {
  try {
    const f = villageLogFile();
    await mkdir(dirname(f), { recursive: true });
    const line = { at: e.at, event: e.event, taskId: e.taskId, ...(e.botId ? { botId: e.botId } : {}), ...(e.reason ? { reason: e.reason.slice(0, 120) } : {}) };
    await appendFile(f, `${JSON.stringify(line)}\n`, 'utf8');
  } catch { /* logging must never break the round */ }
}
