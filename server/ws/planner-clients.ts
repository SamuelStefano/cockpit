import type { WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import { send } from './broadcast';

// Admin-only fan-out: 'planner-get' is admin-gated in authz.ts, so any socket
// that registers here is already admin. broadcast() would reach every role.
const clients = new Set<WebSocket>();

export function registerPlannerClient(ws: WebSocket): void {
  if (clients.has(ws)) return;
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
}

export function emitPlannerMsg(msg: ServerMsg): void {
  for (const ws of clients) send(ws, msg);
}

export function _resetPlannerClients(): void {
  clients.clear();
}
