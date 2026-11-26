import type { WebSocket } from 'ws';
import type { WsConflict } from '../../shared/protocol';
import type { Role } from '../auth';
import { getTeam } from '../team';
import { botDiff, botLog, restoreFile } from '../agents-repo/history';
import { connectRepo, currentConflicts, listInstallationRepos, repoStatus, startSyncTimer, syncAll } from '../agents-repo/remote';
import { send } from './broadcast';
import { ownBotId } from './team-files-frames';

async function ownBot(botId: unknown): Promise<{ id: string; name: string } | undefined> {
  const team = await getTeam();
  const id = ownBotId(team, botId);
  const bot = id ? team.find((b) => b.id === id) : undefined;
  return bot ? { id: bot.id, name: bot.name } : undefined;
}

const teamBots = async () => (await getTeam()).map((b) => ({ id: b.id, name: b.name }));

export async function sendWsLog(ws: WebSocket, botId: unknown): Promise<void> {
  const echo = typeof botId === 'string' ? botId : '';
  const bot = await ownBot(botId);
  const status = await repoStatus();
  if (status.repo) startSyncTimer(teamBots);
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

async function sendStatus(ws: WebSocket, r: { conflicts: WsConflict[] } | { error: string }): Promise<void> {
  const status = await repoStatus();
  if ('error' in r) send(ws, { t: 'team-ws-status', status, conflicts: currentConflicts(), error: r.error });
  else send(ws, { t: 'team-ws-status', status, conflicts: r.conflicts });
}

export async function wsSync(ws: WebSocket, role: Role = 'student'): Promise<void> {
  if (role !== 'admin') { send(ws, { t: 'team-ws-status', status: await repoStatus(), error: 'só o admin sincroniza' }); return; }
  await sendStatus(ws, await syncAll(await teamBots()));
}

// Root-only (shared/root-frames.ts): the list comes from the App installation
// tokens server-side; only repo names reach the client.
export async function sendWsRepos(ws: WebSocket): Promise<void> {
  const repos = await listInstallationRepos().catch(() => []);
  send(ws, { t: 'team-ws-repos', repos, ...(repos.length ? {} : { error: 'o app do GitHub não tem acesso a nenhum repositório' }) });
}

export async function wsConnect(ws: WebSocket, repo: unknown): Promise<void> {
  await sendStatus(ws, await connectRepo(repo, await teamBots()));
}
