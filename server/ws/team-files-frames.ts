import type { WebSocket } from 'ws';
import type { BotComputer, TeamBot } from '../../shared/protocol';
import type { Role } from '../auth';
import { getTeam } from '../team';
import { listBotFiles, readBotFile, writeBotFile } from '../team-files';
import { botComputer } from '../team-computer';
import { send } from './broadcast';

// Only a bot of this account's team: a leftover workspace of a deleted bot, or
// any other dir under bots/, is never served.
export function ownBotId(team: Pick<TeamBot, 'id'>[], botId: unknown): string | undefined {
  return typeof botId === 'string' && team.some((b) => b.id === botId) ? botId : undefined;
}

export async function sendBotFiles(ws: WebSocket, botId: unknown): Promise<void> {
  const id = ownBotId(await getTeam(), botId);
  const echo = typeof botId === 'string' ? botId : '';
  const r = id ? await listBotFiles(id) : { error: 'bot não encontrado' };
  if ('error' in r) send(ws, { t: 'team-files', botId: echo, items: [], error: r.error });
  else send(ws, { t: 'team-files', botId: echo, items: r });
}

export async function sendBotFile(ws: WebSocket, botId: unknown, path: unknown): Promise<void> {
  const id = ownBotId(await getTeam(), botId);
  const echo = typeof botId === 'string' ? botId : '';
  const p = typeof path === 'string' ? path : '';
  const r = id ? await readBotFile(id, path) : { error: 'bot não encontrado' };
  if ('error' in r) send(ws, { t: 'team-file', botId: echo, path: p, error: r.error });
  else send(ws, { t: 'team-file', botId: echo, path: p, mime: r.mime, size: r.size, dataB64: r.dataB64 });
}

// Admin-only (ws/authz.ts): the workspace guards live in writeBotFile.
export async function saveBotFile(ws: WebSocket, botId: unknown, path: unknown, text: unknown, baseMtime: unknown): Promise<void> {
  const id = ownBotId(await getTeam(), botId);
  const echo = typeof botId === 'string' ? botId : '';
  const p = typeof path === 'string' ? path : '';
  const r = id ? await writeBotFile(id, path, text, baseMtime) : { error: 'bot não encontrado' };
  if ('error' in r) send(ws, { t: 'team-file-saved', botId: echo, path: p, ok: false, error: r.error });
  else send(ws, { t: 'team-file-saved', botId: echo, path: p, ok: true, mtime: r.mtime });
}

export async function sendBotComputer(ws: WebSocket, botId: unknown, role: Role = 'student'): Promise<void> {
  const id = ownBotId(await getTeam(), botId);
  const echo = typeof botId === 'string' ? botId : '';
  const r = id ? await botComputer(id) : { error: 'bot não encontrado' };
  if ('error' in r) send(ws, { t: 'team-computer', botId: echo, error: r.error });
  else send(ws, { t: 'team-computer', botId: echo, computer: role === 'admin' ? r : studentView(r) });
}

// Student sees what the bot is doing (step, tool), never its pane, diff or command text.
function studentView(c: BotComputer): BotComputer {
  const live = c.live ? { at: c.live.at, status: c.live.status, step: c.live.step, stepIndex: c.live.stepIndex, stepTotal: c.live.stepTotal, tool: c.live.tool } : undefined;
  return { ...c, preview: [], ...(live ? { live } : {}) };
}
