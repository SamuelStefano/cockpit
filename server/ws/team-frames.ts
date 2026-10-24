import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { isTeamPaused, queryTeamLog, readTeamLog, setTeamPaused } from '../team-log';
import { broadcast, send } from './broadcast';

const ID_RE = /^[a-z0-9]{4,24}$/;
const idOrUndef = (v: unknown) => (typeof v === 'string' && ID_RE.test(v) ? v : undefined);

export async function sendTeamMessages(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-messages-get' }>): Promise<void> {
  const botId = idOrUndef(msg.botId);
  const peer = botId ? idOrUndef(msg.peer) : undefined;
  const before = typeof msg.before === 'number' && Number.isFinite(msg.before) ? msg.before : undefined;
  const items = queryTeamLog(await readTeamLog(), { botId, peer, before });
  send(ws, { t: 'team-messages', items, botId, peer, before });
}

export function sendTeamPaused(ws: WebSocket): void {
  send(ws, { t: 'team-paused', paused: isTeamPaused() });
}

export async function setTeamPause(ws: WebSocket, paused: unknown): Promise<void> {
  if (typeof paused !== 'boolean') { send(ws, { t: 'error', message: 'pausa inválida' }); return; }
  await setTeamPaused(paused);
  broadcast({ t: 'team-paused', paused });
}
