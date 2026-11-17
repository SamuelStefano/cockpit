import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { buildTeamState, followUpHoursOf, type TeamState } from '../../shared/team-state';
import { readTasks } from '../planner/store';
import { getTeam } from '../team';
import { readTeamLog } from '../team-log';
import { readPendingQuestions } from '../team-pending';
import { broadcast, send } from './broadcast';
import { botLiveKey } from './runs';

// Read-only: composed from the team config, the planner board, the team log and the
// live threads. Nothing here is stored; every call is a fresh snapshot.
export async function teamStateSnapshot(followUpHours?: unknown, now = Date.now()): Promise<TeamState> {
  const [team, tasks, log] = await Promise.all([getTeam(), readTasks(), readTeamLog()]);
  const running = new Set(team.filter((b) => botLiveKey(b.id, b.sessionId)).map((b) => b.id));
  const waiting = new Set(readPendingQuestions().map((p) => p.botId));
  return buildTeamState({ team, tasks, log, running, waiting, now, followUpHours: followUpHoursOf(followUpHours) });
}

export async function sendTeamState(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-state-get' }>): Promise<void> {
  send(ws, { t: 'team-state', state: await teamStateSnapshot(msg.followUpHours) });
}

// Pushed to every admin tab when the team's picture changes (a message or a handoff).
// A failing read must not break the message path that triggered it.
export async function broadcastTeamState(): Promise<void> {
  try { broadcast({ t: 'team-state', state: await teamStateSnapshot() }); } catch { /* the next pull recovers */ }
}
