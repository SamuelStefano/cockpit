import type { WebSocket } from 'ws';
import { readSessionFile } from '../session-files';
import { send } from './broadcast';

export async function sendSessionFile(ws: WebSocket, sessionId: unknown, path: unknown): Promise<void> {
  const sid = typeof sessionId === 'string' ? sessionId : '';
  const p = typeof path === 'string' ? path : '';
  const r = await readSessionFile(sessionId, path);
  if ('error' in r) send(ws, { t: 'session-file', sessionId: sid, path: p, error: r.error });
  else send(ws, { t: 'session-file', sessionId: sid, path: p, mime: r.mime, size: r.size, dataB64: r.dataB64 });
}
