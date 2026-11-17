import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { buildTeamState, followUpHoursOf, type TeamState } from '../../shared/team-state';
import { readTasks } from '../planner/store';
import { getTeam } from '../team';
import { readTeamLog } from '../team-log';
import { readPendingQuestions } from '../team-pending';
import type { Role } from '../auth';
import { send } from './broadcast';
import { botLiveKey } from './runs';
import { emitTeamState, registerTeamStateClient } from './team-state-push';

// Read-only: composed from the team config, the planner board, the team log and the
// live threads. Nothing here is stored; every call is a fresh snapshot.
export async function teamStateSnapshot(followUpHours?: unknown, now = Date.now()): Promise<TeamState> {
  const [team, tasks, log] = await Promise.all([getTeam(), readTasks(), readTeamLog()]);
  const running = new Set(team.filter((b) => botLiveKey(b.id, b.sessionId)).map((b) => b.id));
  const waiting = new Set(readPendingQuestions().map((p) => p.botId));
  return buildTeamState({ team, tasks, log, running, waiting, now, followUpHours: followUpHoursOf(followUpHours) });
}

export async function sendTeamState(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-state-get' }>, role?: Role): Promise<void> {
  registerTeamStateClient(ws, role);
  send(ws, { t: 'team-state', state: await teamStateSnapshot(msg.followUpHours) });
}

// Pushed to the admin sockets that asked for the snapshot, never through broadcast().
// A failing read must not break the path that triggered it.
export async function pushTeamState(): Promise<void> {
  try { emitTeamState({ t: 'team-state', state: await teamStateSnapshot() }); } catch { /* the next pull recovers */ }
}
