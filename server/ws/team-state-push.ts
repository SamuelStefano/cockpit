import type { WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { DEFAULT_FOLLOW_UP_HOURS } from '../../shared/team-state';
import { authorize } from './authz';
import { send } from './broadcast';

// Admin-only fan-out, like planner-clients: broadcast() reaches every role, and the
// snapshot carries message previews that 'team-state-get' keeps from students.
const clients = new Map<WebSocket, number>();
const DEBOUNCE_MS = 1000;
let timer: ReturnType<typeof setTimeout> | null = null;

// Called by the 'team-state-get' handler; re-checks the same authz gate so a socket
// that is not allowed to pull the snapshot never gets the push either.
export function registerTeamStateClient(ws: WebSocket, role: Role | undefined, followUpHours = DEFAULT_FOLLOW_UP_HOURS, root = false): boolean {
  if (!role || !authorize(role, 'team-state-get', root)) return false;
  // A repeated get replaces the window: each socket keeps its own last one.
  if (!clients.has(ws)) ws.on('close', () => clients.delete(ws));
  clients.set(ws, followUpHours);
  return true;
}

export function teamStateWindows(): Set<number> {
  return new Set(clients.values());
}

export function emitTeamState(frameFor: (followUpHours: number) => ServerMsg): void {
  for (const [ws, hours] of clients) send(ws, frameFor(hours));
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
