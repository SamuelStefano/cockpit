import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { buildTeamState, followUpHoursOf, type TeamState } from '../../shared/team-state';
import { getTeam } from '../team';
import { readTasksCached, readTeamLogCached } from '../team-state-cache';
import { readPendingQuestions } from '../team-pending';
import type { Role } from '../auth';
import { send } from './broadcast';
import { botLiveKey } from './runs';
import { emitTeamState, registerTeamStateClient, teamStateWindows } from './team-state-push';

// Read-only: composed from the team config, the planner board, the team log and the
// live threads. Nothing here is stored; every call is a fresh snapshot.
export async function teamStateSnapshots(hours: number[], now = Date.now()): Promise<Map<number, TeamState>> {
  const [team, tasks, log] = await Promise.all([getTeam(), readTasksCached(), readTeamLogCached()]);
  const running = new Set(team.filter((b) => botLiveKey(b.id, b.sessionId)).map((b) => b.id));
  const waiting = new Set(readPendingQuestions().map((p) => p.botId));
  return new Map(hours.map((h) => [h, buildTeamState({ team, tasks, log, running, waiting, now, followUpHours: h })]));
}

export async function teamStateSnapshot(followUpHours?: unknown, now = Date.now()): Promise<TeamState> {
  const h = followUpHoursOf(followUpHours);
  return (await teamStateSnapshots([h], now)).get(h)!;
}

export async function sendTeamState(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-state-get' }>, role?: Role): Promise<void> {
  registerTeamStateClient(ws, role, followUpHoursOf(msg.followUpHours));
  send(ws, { t: 'team-state', state: await teamStateSnapshot(msg.followUpHours) });
}

// Pushed to the admin sockets that asked for the snapshot, never through broadcast().
// Each socket gets the window it asked for last; one read serves every window.
// A failing read must not break the path that triggered it.
export async function pushTeamState(): Promise<void> {
  try {
    const wanted = teamStateWindows();
    if (wanted.size === 0) return;
    const snaps = await teamStateSnapshots([...wanted]);
    emitTeamState((h) => ({ t: 'team-state', state: snaps.get(h)! }));
  } catch { /* the next pull recovers */ }
}
