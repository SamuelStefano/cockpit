import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { panelFor, type TeamPanel } from '../../shared/team-panel';
import { getTeam } from '../team';
import { readPendingQuestions } from '../team-pending';
import { PR_REFRESH_FLOOR_MS, teamPanelSnapshot } from '../team-prs';
import type { Role } from '../auth';
import { authorize } from './authz';
import { send } from './broadcast';
import { teamStateSnapshot } from './team-state-frames';
import { registerTeamStateClient } from './team-state-push';

// Admin-only, like team-state. `recording` is kept per socket and applied here, on
// the server: the client flag only asks for it, the redaction never runs in the browser.
const clients = new Map<WebSocket, boolean>();
let poll: ReturnType<typeof setInterval> | null = null;

async function build(): Promise<TeamPanel> {
  const [team, state] = await Promise.all([getTeam(), teamStateSnapshot()]);
  return teamPanelSnapshot({ team, state, pending: readPendingQuestions() });
}

export async function sendTeamPanel(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-panel-get' }>, role?: Role): Promise<void> {
  if (!role || !authorize(role, 'team-panel-get')) return;
  // The team-state registration is what makes board/run changes schedule a push.
  registerTeamStateClient(ws, role);
  if (!clients.has(ws)) ws.on('close', () => { clients.delete(ws); stopPollIfIdle(); });
  clients.set(ws, msg.recording === true);
  startPoll();
  send(ws, { t: 'team-panel', panel: panelFor(await build(), msg.recording === true) });
}

export async function pushTeamPanel(): Promise<void> {
  if (clients.size === 0) return;
  try {
    const panel = await build();
    for (const [ws, recording] of clients) send(ws, { t: 'team-panel', panel: panelFor(panel, recording) });
  } catch { /* the next pull recovers */ }
}

function startPoll(): void {
  if (poll) return;
  poll = setInterval(() => { void pushTeamPanel(); }, PR_REFRESH_FLOOR_MS);
  poll.unref?.();
}

function stopPollIfIdle(): void {
  if (clients.size > 0 || !poll) return;
  clearInterval(poll);
  poll = null;
}

export function _resetTeamPanelClients(): void {
  clients.clear();
  stopPollIfIdle();
}
