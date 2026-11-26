import type { WebSocket } from 'ws';
import type { WsRepoStatus } from '../../shared/protocol';
import type { Role } from '../auth';
import { getTeam } from '../team';
import { botDiff, botLog, headStatus, restoreFile } from '../agents-repo/history';
import { send } from './broadcast';
import { ownBotId } from './team-files-frames';

async function ownBot(botId: unknown): Promise<{ id: string; name: string } | undefined> {
  const team = await getTeam();
  const id = ownBotId(team, botId);
  const bot = id ? team.find((b) => b.id === id) : undefined;
  return bot ? { id: bot.id, name: bot.name } : undefined;
}

export async function repoStatus(): Promise<WsRepoStatus> {
  return headStatus().catch(() => ({}));
}

export async function sendWsLog(ws: WebSocket, botId: unknown): Promise<void> {
  const echo = typeof botId === 'string' ? botId : '';
  const bot = await ownBot(botId);
  const status = await repoStatus();
  if (!bot) { send(ws, { t: 'team-ws-log', botId: echo, items: [], status, error: 'bot não encontrado' }); return; }
  const items = await botLog(bot.id).catch(() => []);
  send(ws, { t: 'team-ws-log', botId: echo, items, status });
}

export async function sendWsDiff(ws: WebSocket, botId: unknown, hash: unknown): Promise<void> {
  const echo = typeof botId === 'string' ? botId : '';
  const h = typeof hash === 'string' ? hash : '';
  const bot = await ownBot(botId);
  const r = bot ? await botDiff(bot.id, hash) : { error: 'bot não encontrado' };
  if ('error' in r) send(ws, { t: 'team-ws-diff', botId: echo, hash: h, files: [], patch: '', error: r.error });
  else send(ws, { t: 'team-ws-diff', botId: echo, hash: h, files: r.files, patch: r.patch });
}

export async function wsRestore(ws: WebSocket, botId: unknown, hash: unknown, path: unknown, role: Role = 'student'): Promise<void> {
  const echo = typeof botId === 'string' ? botId : '';
  const p = typeof path === 'string' ? path : '';
  if (role !== 'admin') { send(ws, { t: 'team-ws-restored', botId: echo, path: p, ok: false, error: 'só o admin restaura versões' }); return; }
  const bot = await ownBot(botId);
  const r = bot ? await restoreFile(bot.id, bot.name, hash, path) : { error: 'bot não encontrado' };
  if ('error' in r) { send(ws, { t: 'team-ws-restored', botId: echo, path: p, ok: false, error: r.error }); return; }
  send(ws, { t: 'team-ws-restored', botId: echo, path: p, ok: true });
  await sendWsLog(ws, bot!.id);
}
