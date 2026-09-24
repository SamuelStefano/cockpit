import type { WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import { send } from './broadcast';

// Admin-only push target for canvas signals that must NOT go through the
// global broadcast() (fans out to every connected socket regardless of role —
// server/ws/broadcast.ts's own doc comment) and must NOT reuse the generic
// keyless `{t:'error'}` frame either: every tab's onMsg handler treats ANY
// keyless error as "the active turn/handoff broke" (src/useCockpit.ts calls
// endHandoff() unconditionally on 'error', and src/cockpit/useCanvas.ts marks
// the canvas stale if one lands mid canvas-get) — both wrong for a background
// flow failure nobody asked about.
//
// Registered on 'canvas-get' (mirrors server/ws/finance-clients.ts's
// registerFinanceClient on 'points-dfl-get'): 'canvas-get' is already
// admin-only at server/ws/authz.ts (not in STUDENT_ALLOWED), so any socket
// that ever reaches the handler is guaranteed role==='admin' — no separate
// role check needed here.
const clients = new Set<WebSocket>();

export function registerCanvasClient(ws: WebSocket): void {
  if (clients.has(ws)) return;
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
}

export function hasCanvasClients(): boolean {
  return clients.size > 0;
}

export function emitCanvasMsg(msg: ServerMsg): void {
  for (const ws of clients) send(ws, msg);
}

// Test-only: the registry is module-level, reset between cases.
export function _resetCanvasClients(): void {
  clients.clear();
}
