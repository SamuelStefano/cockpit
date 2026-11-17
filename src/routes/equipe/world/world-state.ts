import type { TeamState, TeamBotStatus } from '../../../../shared/team-state';
import { HOUSES, type BuildingId } from './world-map';

export type ProjectId = string;
const OFFICE = 'escritorio';
const TASK_KEYWORDS: readonly (readonly [string, string])[] = [['itera', 'itera'], ['dfl', 'dfl'], ['radar', 'corte-radar']];

// What the world is allowed to know about a bot: name, state, counts. The snapshot
// also carries task titles and message previews; they are dropped here on purpose,
// so nothing downstream (scene, labels, recordings) can ever draw them.
export interface NpcView {
  id: string;
  name: string;
  mode: TeamBotStatus;
  badge: string | null;
  // Where the bot works when it is working (an id, never text).
  project: ProjectId;
  // True while an existing meeting that includes this bot is running.
  meeting: boolean;
}

export interface Flight { key: string; from: string | null; to: string }

export interface WorldView {
  npcs: NpcView[];
  flights: Flight[];
  // Count badge per project house id; absent id = badge hidden.
  projects: Record<string, string>;
  // Number of bots in the running meeting (0 = none).
  meetingSize: number;
}

export type NpcAnim = 'work' | 'idle' | 'wait';
export interface NpcSprite { anim: NpcAnim; bubble: 'zz' | '!' | null; tool: boolean }

type HouseRef = { id: string; department?: string };

// Order: the bot's project field (a known house id), a keyword in its task, its department's house, the office.
export function projectOf(bot: { project?: string; task?: string; sector?: string }, houses: readonly HouseRef[] = HOUSES): ProjectId {
  const known = (id: string): boolean => houses.some((h) => h.id === id);
  if (bot.project && known(bot.project)) return bot.project;
  const task = bot.task?.toLowerCase() ?? '';
  const hit = TASK_KEYWORDS.find(([kw, id]) => task.includes(kw) && known(id));
  if (hit) return hit[1];
  const byDept = bot.sector ? houses.find((h) => h.department === bot.sector) : undefined;
  return byDept?.id ?? OFFICE;
}

export type Station = 'plaza' | 'sala' | BuildingId;

// Working bots sit at a desk, bots in a meeting sit in the room, everyone else stays on the plaza.
export function stationOf(n: Pick<NpcView, 'mode' | 'project' | 'meeting'>): Station {
  if (n.meeting) return 'sala';
  return n.mode === 'working' ? n.project : 'plaza';
}

export const FLIGHT_WINDOW_MS = 10 * 60_000;

export function npcSprite(mode: TeamBotStatus): NpcSprite {
  if (mode === 'working') return { anim: 'work', bubble: null, tool: true };
  if (mode === 'waiting') return { anim: 'wait', bubble: '!', tool: false };
  return { anim: 'idle', bubble: 'zz', tool: false };
}

// Day count badge: hidden when there is no count (or zero).
export function badgeText(n: number | undefined): string | null {
  if (n === undefined || !Number.isFinite(n) || n <= 0) return null;
  return n > 99 ? '99+' : String(Math.floor(n));
}

export interface DeriveOptions {
  // Tasks/PRs of the day per bot id. Absent for a bot = badge hidden.
  counts?: Record<string, number>;
  // Count per project house id (hidden when absent).
  projects?: Record<string, number>;
  now?: number;
  // The running meeting (existing meeting state), by participant ids only.
  meeting?: { participantIds: string[] } | null;
}

export function deriveWorld(state: TeamState | null, opts: DeriveOptions = {}): WorldView {
  if (!state) return { npcs: [], flights: [], projects: {}, meetingSize: 0 };
  const now = opts.now ?? state.at;
  const ids = new Set(state.bots.map((b) => b.id));
  const inMeeting = new Set((opts.meeting?.participantIds ?? []).filter((id) => ids.has(id)));
  const npcs = state.bots.map((b): NpcView => ({
    id: b.id, name: b.name, mode: b.status, badge: badgeText(opts.counts?.[b.id]),
    project: projectOf(b), meeting: inMeeting.has(b.id),
  }));
  const flights = state.handoffs
    .filter((h) => ids.has(h.to) && now - h.at <= FLIGHT_WINDOW_MS)
    .map((h): Flight => ({ key: `${h.taskId}:${h.at}`, from: h.from && ids.has(h.from) ? h.from : null, to: h.to }));
  const projects: Record<string, string> = {};
  for (const [id, n] of Object.entries(opts.projects ?? {})) { const t = badgeText(n); if (t) projects[id] = t; }
  return { npcs, flights, projects, meetingSize: inMeeting.size };
}
