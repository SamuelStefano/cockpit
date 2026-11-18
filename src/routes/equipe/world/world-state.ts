import type { TeamState, TeamBotStatus } from '../../../../shared/team-state';
import type { BuildingId } from './world-map';
import { plazaBreakers } from './world-break';
import { homeOf } from './world-home';

const HEX = /^#[0-9a-fA-F]{6}$/;

// What the world is allowed to know about a bot: name, state, counts. The snapshot
// also carries task titles and message previews; they are dropped here on purpose,
// so nothing downstream (scene, labels, recordings) can ever draw them.
export interface NpcView {
  id: string;
  name: string;
  mode: TeamBotStatus;
  badge: string | null;
  // The building the bot lives in (an id, never text).
  home: string;
  // Preferred desk index inside the home, when the bot has one and the house is its own.
  homeSeat?: number;
  // True during the short plaza stroll of a bot that has been idle for a long time.
  onBreak: boolean;
  sprite?: string;
  // Mascot colour as #rrggbb, never free text.
  color?: string;
  // True while an existing meeting that includes this bot is running.
  meeting: boolean;
  moderator?: boolean;
}

export interface Flight { key: string; from: string | null; to: string }

export interface WorldView {
  npcs: NpcView[];
  flights: Flight[];
  // Count badge per project house id; absent id = badge hidden.
  projects: Record<string, string>;
  // Number of bots in the running meeting (0 = none).
  meetingSize: number;
  // Bot ids whose PR just merged (ids only). The scene plays each array once, by identity.
  celebrate: string[];
}

export type NpcAnim = 'work' | 'idle' | 'wait';
export interface NpcSprite { anim: NpcAnim; bubble: 'zz' | '!' | null; tool: boolean }

export type Station = 'plaza' | 'sala' | BuildingId;

// Meeting bots sit in the room; a bot on its plaza break is on the plaza; everyone else
// (working, idle, waiting) stays in its home building.
export function stationOf(n: Pick<NpcView, 'home' | 'meeting' | 'onBreak'>): Station {
  if (n.meeting) return 'sala';
  return n.onBreak ? 'plaza' : n.home;
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
  meeting?: { participantIds: string[]; moderatorId?: string } | null;
  celebrate?: string[];
}

const NO_IDS: string[] = [];
// Same array back when every id is known, so the scene can tell a new celebration from a re-render.
const knownIds = (list: string[] | undefined, ids: Set<string>): string[] => (!list || list.length === 0 ? NO_IDS : list.every((id) => ids.has(id)) ? list : list.filter((id) => ids.has(id)));

export function deriveWorld(state: TeamState | null, opts: DeriveOptions = {}): WorldView {
  if (!state) return { npcs: [], flights: [], projects: {}, meetingSize: 0, celebrate: [] };
  const now = opts.now ?? state.at;
  const ids = new Set(state.bots.map((b) => b.id));
  const moderatorId = opts.meeting?.moderatorId && ids.has(opts.meeting.moderatorId) ? opts.meeting.moderatorId : undefined;
  const inMeeting = new Set([...(opts.meeting?.participantIds ?? []), ...(moderatorId ? [moderatorId] : [])].filter((id) => ids.has(id)));
  const breakers = plazaBreakers(now, state.bots.filter((b) => b.status === 'idle'));
  const npcs = state.bots.map((b): NpcView => ({
    id: b.id, name: b.name, mode: b.status, badge: badgeText(opts.counts?.[b.id]),
    home: homeOf(b), ...(b.homeSeat !== undefined && b.home === homeOf(b) ? { homeSeat: b.homeSeat } : {}), onBreak: breakers.has(b.id), ...(b.sprite ? { sprite: b.sprite } : {}), ...(HEX.test(b.color ?? '') ? { color: b.color } : {}), meeting: inMeeting.has(b.id),
    ...(b.id === moderatorId ? { moderator: true } : {}),
  }));
  const flights = state.handoffs
    .filter((h) => ids.has(h.to) && now - h.at <= FLIGHT_WINDOW_MS)
    .map((h): Flight => ({ key: `${h.taskId}:${h.at}`, from: h.from && ids.has(h.from) ? h.from : null, to: h.to }));
  const projects: Record<string, string> = {};
  for (const [id, n] of Object.entries(opts.projects ?? {})) { const t = badgeText(n); if (t) projects[id] = t; }
  return { npcs, flights, projects, meetingSize: inMeeting.size, celebrate: knownIds(opts.celebrate, ids) };
}
