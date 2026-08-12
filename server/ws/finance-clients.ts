import type { WebSocket } from 'ws';
import type { DflPointsSnapshot } from '../../shared/protocol';
import { send } from './broadcast';

// Registro OWNER-ONLY dos sockets que pediram o snapshot financeiro. Dado
// financeiro NÃO pode usar o broadcast() global (fan-out cego por source.clients);
// aqui o push é roteado por identidade da conexão — só sockets que passaram pelo
// authorize (admin/root, pois points-dfl-* NÃO está no STUDENT_ALLOWED) e pediram
// points-dfl-get entram no set. emitFinance mira só eles. Ver plano
// 20260722-deck-pontos-financeiro (D5) e a skill app-security.
const clients = new Set<WebSocket>();

export function registerFinanceClient(ws: WebSocket): void {
  if (clients.has(ws)) return;
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
}

export function hasFinanceClients(): boolean { return clients.size > 0; }

export function emitFinance(snapshot: DflPointsSnapshot | null): void {
  for (const ws of clients) send(ws, { t: 'points-dfl', snapshot });
}

// só p/ teste: zera o registro entre casos.
export function _resetFinanceClients(): void { clients.clear(); }
