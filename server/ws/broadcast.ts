import type { WebSocketServer, WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';

// Fan-out: frames de um run vão pra TODOS os clientes abertos, não pra um socket
// fixo. Sem isto, uma 2ª aba (ou um reconnect que cria o socket novo antes do
// 'close' do antigo) rouba o stream e congela a aba anterior no meio do turno.
// O cliente já deduplica por sessionKey/runMsg, então cada aba renderiza uma vez.
//
// A fonte de clientes é abstraída (ClientSource) pra o mesmo broadcast servir os
// dois transportes: no modo listen (app de hoje) é o WebSocketServer (.clients é
// um Set); no modo dial (agente T3 que disca pro relay) é um Set explícito de
// sockets de saída. Modo listen segue idêntico — setWss continua recebendo o wss.
interface ClientSource { readonly clients: Iterable<WebSocket> }
let source: ClientSource | null = null;
export function setWss(wss: WebSocketServer | null) { source = wss; }
export function setClientSource(s: ClientSource | null) { source = s; }

// Backpressure: num socket lento-mas-aberto (celular em wifi ruim, laptop
// dormindo) o buffer do ws cresce sem limite até estourar a heap — o vetor real
// de OOM na madrugada. Frames de alta frequência e reconstruíveis (delta/
// thinking/stats) são pulados PRA ESSE cliente quando o buffer passa do teto; o
// snapshot do thread (capTail) replaya no próximo reconnect. Frames de ciclo de
// vida (started/tool/usage/done/error/...) sempre vão.
export const BACKPRESSURE_BYTES = 4 * 1024 * 1024;
const DROPPABLE: ReadonlySet<string> = new Set(['delta', 'thinking', 'stats']);

export function broadcast(msg: ServerMsg) {
  if (!source) return;
  const payload = JSON.stringify(msg);
  const droppable = DROPPABLE.has(msg.t);
  for (const c of source.clients) {
    if (c.readyState !== c.OPEN) continue;
    if (droppable && c.bufferedAmount > BACKPRESSURE_BYTES) continue;
    // ws.send pode lançar se o socket fechar entre o check e o envio; um cliente
    // morto não pode abortar o fan-out pros demais (perderiam o `done`).
    try { c.send(payload); } catch { /* socket fechou no meio do loop */ }
  }
}

export function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(msg)); } catch { /* socket fechou entre o check e o envio */ }
}
