import type { WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { botIdFromKey, botThreadKey } from '../../shared/team';
import { buildTalkInfo, buildTalkSnapshot, releaseDelta, talkChunkFor, talkPayloadFor, TALK_MAX_TEXT, type TalkChunk } from '../../shared/team-talk';
import type { Role } from '../auth';
import { getTeam } from '../team';
import { authorize } from './authz';
import { addBroadcastTap, send, setRecordingDrop, setSocketRecording } from './broadcast';
import { isTeamPaused } from '../team-log';
import { threads } from './threads';
import { readPendingQuestions } from '../team-pending';
import { getPrsSnapshot } from '../github/prs';
import { teamStateSnapshot } from './team-state-frames';

// Admin-only dialog with a bot, inside the game. It never opens a session: a bot
// without one answers 'no-session'. Sending goes through the normal 'send' path
// (triage, profile, the bot's bound session), the stream is re-emitted per socket
// and the recording flag is applied here, on the server.
interface Sub { botId: string; recording: boolean; tail: string }
const subs = new Map<WebSocket, Sub>();
// One dialog message in flight per bot: the next one waits for the end of that turn.
const inFlight = new Map<string, { msgId: string; at: number }>();
export const IN_FLIGHT_TTL_MS = 10 * 60_000;
let untap: (() => void) | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
export const TALK_REFRESH_MS = 15_000;

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

async function snapshot(botId: string) {
  const [team, state, prs] = await Promise.all([getTeam(), teamStateSnapshot().catch(() => null), getPrsSnapshot(false).catch(() => null)]);
  const bot = team.find((b) => b.id === botId);
  if (!bot) return null;
  const now = Date.now();
  const info = buildTalkInfo(bot, state?.bots.find((b) => b.id === botId), prs, readPendingQuestions(), now);
  return buildTalkSnapshot(bot, info, now);
}

async function pushSnapshot(ws: WebSocket, botId: string, recording: boolean): Promise<void> {
  const s = await snapshot(botId).catch(() => null);
  if (s) send(ws, { t: 'team-talk', talk: talkPayloadFor(s, recording) });
}

function emitChunk(botId: string, msgId: string | undefined, chunk: TalkChunk): void {
  for (const [ws, sub] of subs) if (sub.botId === botId) send(ws, { t: 'team-talk-chunk', botId, msgId, chunk: talkChunkFor(chunk, sub.recording) });
}

function emitDelta(botId: string, msgId: string | undefined, text: string): void {
  for (const [ws, sub] of subs) {
    if (sub.botId !== botId) continue;
    if (sub.recording) { send(ws, { t: 'team-talk-chunk', botId, msgId, chunk: talkChunkFor({ kind: 'delta', text }, true) }); continue; }
    const r = releaseDelta(sub.tail, text);
    sub.tail = r.tail;
    if (r.out) send(ws, { t: 'team-talk-chunk', botId, msgId, chunk: { kind: 'delta', text: r.out } });
  }
}

function flushTails(botId: string, msgId: string | undefined): void {
  for (const [ws, sub] of subs) {
    if (sub.botId !== botId || sub.recording || !sub.tail) continue;
    const r = releaseDelta(sub.tail, ' ');
    sub.tail = '';
    if (r.out.trim()) send(ws, { t: 'team-talk-chunk', botId, msgId, chunk: { kind: 'delta', text: r.out.trimEnd() } });
  }
}

const openMsg = (botId: string): string | undefined => {
  const f = inFlight.get(botId);
  if (f && Date.now() - f.at > IN_FLIGHT_TTL_MS) inFlight.delete(botId);
  return inFlight.get(botId)?.msgId;
};

// Frames the recording sockets must not receive through the normal fan-out: anything a bot
// turn carries except its lifecycle, and the team chat messages.
const LIFECYCLE = new Set(['started', 'done']);
function recordingDrops(m: ServerMsg): boolean {
  if (m.t === 'team-message') return true;
  if (!('sessionKey' in m) || typeof m.sessionKey !== 'string') return false;
  return !LIFECYCLE.has(m.t) && !!ownerOf(m.sessionKey);
}

function ownerOf(sessionKey: string): string | undefined {
  return threads.get(sessionKey)?.params.botId ?? botIdFromKey(sessionKey) ?? undefined;
}

function onFrame(m: ServerMsg): void {
  if (subs.size === 0 || !('sessionKey' in m) || typeof m.sessionKey !== 'string') return;
  const botId = ownerOf(m.sessionKey);
  if (!botId) return;
  const msgId = openMsg(botId);
  if (m.t === 'delta') emitDelta(botId, msgId, m.text);
  else if (m.t === 'done') { flushTails(botId, msgId); emitChunk(botId, msgId, { kind: 'done' }); inFlight.delete(botId); for (const [ws, s] of subs) if (s.botId === botId) void pushSnapshot(ws, botId, s.recording); }
  else if (m.t === 'send-reject') { emitChunk(botId, msgId, { kind: 'error', message: m.message }); inFlight.delete(botId); }
  else if (m.t === 'error') { flushTails(botId, msgId); emitChunk(botId, msgId, { kind: 'error', message: m.message }); inFlight.delete(botId); }
}

function start(): void {
  untap ??= addBroadcastTap(onFrame);
  setRecordingDrop(recordingDrops);
  poll ??= setInterval(() => { for (const [ws, s] of subs) void pushSnapshot(ws, s.botId, s.recording); }, TALK_REFRESH_MS);
  poll.unref?.();
}

function stopIfIdle(): void {
  if (subs.size > 0) return;
  untap?.(); untap = null;
  setRecordingDrop(null);
  if (poll) { clearInterval(poll); poll = null; }
}

export async function sendTalk(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-talk-get' }>, role?: Role): Promise<void> {
  if (!role || !authorize(role, 'team-talk-get')) return;
  if (typeof msg.botId !== 'string' || !ID_RE.test(msg.botId)) { send(ws, { t: 'error', message: 'bot inválido' }); return; }
  const recording = msg.recording === true;
  setSocketRecording(ws, recording);
  if (!subs.has(ws)) ws.on('close', () => { subs.delete(ws); stopIfIdle(); });
  subs.set(ws, { botId: msg.botId, recording, tail: '' });
  start();
  const s = await snapshot(msg.botId);
  if (!s) { subs.delete(ws); stopIfIdle(); send(ws, { t: 'error', message: 'bot não encontrado' }); return; }
  send(ws, { t: 'team-talk', talk: talkPayloadFor(s, recording) });
}

type Handle = (ws: WebSocket, msg: ClientMsg, role?: Role) => Promise<void>;

export async function sendTalkMessage(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-talk-send' }>, role: Role | undefined, handle: Handle): Promise<void> {
  if (!role || !authorize(role, 'team-talk-send')) return;
  if (typeof msg.botId !== 'string' || !ID_RE.test(msg.botId)) { send(ws, { t: 'error', message: 'bot inválido' }); return; }
  const refuse = (reason: 'no-session' | 'empty' | 'too-long' | 'paused' | 'busy') => send(ws, { t: 'team-talk-chunk', botId: msg.botId, msgId: msg.msgId, chunk: { kind: 'refused', reason } });
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  if (!text) return refuse('empty');
  if (text.length > TALK_MAX_TEXT) return refuse('too-long');
  const bot = (await getTeam()).find((b) => b.id === msg.botId);
  if (!bot) { send(ws, { t: 'error', message: 'bot não encontrado' }); return; }
  if (!bot.sessionId) return refuse('no-session');
  if (isTeamPaused()) return refuse('paused');
  if (openMsg(bot.id)) return refuse('busy');
  // Follow the bot's turn even if this socket never asked for the snapshot.
  setSocketRecording(ws, msg.recording === true);
  if (!subs.has(ws)) { subs.set(ws, { botId: bot.id, recording: msg.recording === true, tail: '' }); ws.on('close', () => { subs.delete(ws); stopIfIdle(); }); start(); }
  else subs.set(ws, { botId: bot.id, recording: msg.recording === true, tail: '' });
  inFlight.set(bot.id, { msgId: msg.msgId, at: Date.now() });
  await handle(ws, { t: 'send', sessionKey: botThreadKey(bot.id), sessionId: bot.sessionId, text, msgId: msg.msgId }, role);
}

export function _resetTalkForTests(): void {
  subs.clear();
  inFlight.clear();
  stopIfIdle();
}
