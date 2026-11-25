import type { WebSocket } from 'ws';
import { readSessionFile } from '../session-files';
import { send } from './broadcast';

// The echo is the client's cache key; an oversized or non-string one is not reflected back.
const echo = (v: unknown) => (typeof v === 'string' && v.length <= 1024 ? v : '');

export async function sendSessionFile(ws: WebSocket, sessionId: unknown, path: unknown): Promise<void> {
  const sid = echo(sessionId);
  const p = echo(path);
  const r = await readSessionFile(sessionId, path);
  if ('error' in r) send(ws, { t: 'session-file', sessionId: sid, path: p, error: r.error });
  else send(ws, { t: 'session-file', sessionId: sid, path: p, mime: r.mime, size: r.size, dataB64: r.dataB64, truncated: r.truncated });
}
