import type { WebSocket } from 'ws';
import { sanitize } from '../engine/claude';
import { broadcast, send } from './broadcast';

// Trabalho deliberadamente DESTACADO do loop de mensagens (roda por minutos e não
// pode segurar o socket). Um `void promessa` aqui seria uma bomba: a rejeição não
// tem mais quem a pegue, cai no unhandledRejection do index.ts e ele derruba o
// backend inteiro — matando todos os runs por causa de um único handler que falhou.
// Reporta o erro no socket que pediu (ou em broadcast, quando o pedido não tem dono)
// e segue vivo.
export function detach(ws: WebSocket | null, p: Promise<unknown>, sessionKey?: string): void {
  p.catch((e: unknown) => {
    const message = sanitize(String((e as Error)?.message ?? e));
    if (ws) send(ws, { t: 'error', sessionKey, message });
    else broadcast({ t: 'error', sessionKey, message });
  });
}
