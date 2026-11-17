import type { WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { authorize } from './authz';
import { send } from './broadcast';

// Admin-only fan-out, like planner-clients: broadcast() reaches every role, and the
// snapshot carries message previews that 'team-state-get' keeps from students.
const clients = new Set<WebSocket>();
const DEBOUNCE_MS = 1000;
let timer: ReturnType<typeof setTimeout> | null = null;

// Called by the 'team-state-get' handler; re-checks the same authz gate so a socket
// that is not allowed to pull the snapshot never gets the push either.
export function registerTeamStateClient(ws: WebSocket, role: Role | undefined, root = false): boolean {
  if (!role || !authorize(role, 'team-state-get', root)) return false;
  if (clients.has(ws)) return true;
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  return true;
}

export function emitTeamState(msg: ServerMsg): void {
  for (const ws of clients) send(ws, msg);
}

// Runs start/end and board moves come in bursts; one snapshot per second is plenty.
export function scheduleTeamStatePush(delayMs = DEBOUNCE_MS): void {
  if (clients.size === 0 || timer) return;
  timer = setTimeout(() => {
    timer = null;
    // Lazy: team-state-frames imports runs.ts, which calls this module.
    void import('./team-state-frames').then((m) => m.pushTeamState()).catch(() => { /* the next pull recovers */ });
  }, delayMs);
  timer.unref?.();
}

export function _resetTeamStateClients(): void {
  clients.clear();
  if (timer) clearTimeout(timer);
  timer = null;
}
