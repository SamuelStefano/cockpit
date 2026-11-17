import type { TeamState, TeamBotStatus } from '../../../../shared/team-state';

// What the world is allowed to know about a bot: name, state, counts. The snapshot
// also carries task titles and message previews; they are dropped here on purpose,
// so nothing downstream (scene, labels, recordings) can ever draw them.
export interface NpcView {
  id: string;
  name: string;
  mode: TeamBotStatus;
  badge: string | null;
}

export interface Flight { key: string; from: string | null; to: string }

export interface WorldView {
  npcs: NpcView[];
  flights: Flight[];
  // Count badge per project house id; absent id = badge hidden.
  projects: Record<string, string>;
}

export type NpcAnim = 'work' | 'idle' | 'wait';
export interface NpcSprite { anim: NpcAnim; bubble: 'zz' | '!' | null; tool: boolean }

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
}

export function deriveWorld(state: TeamState | null, opts: DeriveOptions = {}): WorldView {
  if (!state) return { npcs: [], flights: [], projects: {} };
  const now = opts.now ?? state.at;
  const ids = new Set(state.bots.map((b) => b.id));
  const npcs = state.bots.map((b): NpcView => ({ id: b.id, name: b.name, mode: b.status, badge: badgeText(opts.counts?.[b.id]) }));
  const flights = state.handoffs
    .filter((h) => ids.has(h.to) && now - h.at <= FLIGHT_WINDOW_MS)
    .map((h): Flight => ({ key: `${h.taskId}:${h.at}`, from: h.from && ids.has(h.from) ? h.from : null, to: h.to }));
  const projects: Record<string, string> = {};
  for (const [id, n] of Object.entries(opts.projects ?? {})) { const t = badgeText(n); if (t) projects[id] = t; }
  return { npcs, flights, projects };
}
