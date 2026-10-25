import type { TeamBot } from './protocol';

export type TeamMessageStatus = 'delivered' | 'queued' | 'blocked' | 'failed';

// One bot→bot message as the log keeps it (~/.cockpit/team-messages.jsonl).
// `hop` is the chain depth: a message sent from a turn that a human started is 1,
// a message sent from a turn that another message started is that message's hop+1.
export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  ts: number;
  status: TeamMessageStatus;
  hop: number;
  reason?: string;
}

export const MAX_TEAM_HOPS = 6;
export const MAX_TEAM_MSGS_PER_HOUR = 30;
export const MAX_TEAM_TEXT_BYTES = 8 * 1024;
export const TEAM_MSG_ID_RE = /^m[a-z0-9]{6,32}$/;
export const TEAM_MCP_NAME = 'deck-team';
export const TEAM_MCP_TOOLS = [`mcp__${TEAM_MCP_NAME}__team_list`, `mcp__${TEAM_MCP_NAME}__team_send`];

export type TeamVerdict = { ok: true } | { ok: false; reason: string };

// The three brakes, in the order a person reads them: the global switch first,
// then the chain depth, then the sender's hourly budget.
export function judgeTeamMessage(o: { paused: boolean; hop: number; sentLastHour: number }): TeamVerdict {
  if (o.paused) return { ok: false, reason: 'equipe pausada' };
  if (o.hop >= MAX_TEAM_HOPS) return { ok: false, reason: `cadeia longa demais (${o.hop} saltos)` };
  if (o.sentLastHour >= MAX_TEAM_MSGS_PER_HOUR) return { ok: false, reason: `teto de ${MAX_TEAM_MSGS_PER_HOUR} mensagens por hora` };
  return { ok: true };
}

const PROMPT_RE = /^\[Mensagem de ([^\]\n]{1,40})\]\n/;

export function teamPrompt(fromName: string, text: string): string {
  return `[Mensagem de ${fromName}]\n${text}`;
}

// The sender's name when a user turn is a delivered team message.
export function teamPromptSender(text: string): string | undefined {
  return PROMPT_RE.exec(text)?.[1];
}

export function involves(m: Pick<TeamMessage, 'from' | 'to'>, botId: string): boolean {
  return m.from === botId || m.to === botId;
}

export function betweenPair(m: Pick<TeamMessage, 'from' | 'to'>, a: string, b: string): boolean {
  return (m.from === a && m.to === b) || (m.from === b && m.to === a);
}

export interface TrafficGroup {
  key: string;
  ts: number;
  items: TeamMessage[];
  peers: string[];
}

// Collapses a bot's bot↔bot traffic into the separators its thread shows: every
// run of messages that falls between the same two thread messages becomes one
// group, placed by the time of its first message. `anchors` are the thread's
// message timestamps.
export function groupTeamTraffic(botId: string, log: TeamMessage[], anchors: number[]): TrafficGroup[] {
  const sorted = [...anchors].filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  const slotOf = (ts: number) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= ts) lo = mid + 1; else hi = mid; }
    return lo;
  };
  const groups: TrafficGroup[] = [];
  let slot = -1;
  for (const m of [...log].filter((x) => involves(x, botId)).sort((a, b) => a.ts - b.ts)) {
    const s = slotOf(m.ts);
    const peer = m.from === botId ? m.to : m.from;
    const cur = groups[groups.length - 1];
    if (cur && s === slot) {
      cur.items.push(m);
      if (!cur.peers.includes(peer)) cur.peers.push(peer);
    } else {
      groups.push({ key: m.id, ts: m.ts, items: [m], peers: [peer] });
      slot = s;
    }
  }
  return groups;
}

// The roster preview line for a team message, from the bot's point of view.
export function trafficLine(botId: string, m: TeamMessage, nameOf: (id: string) => string): string {
  return m.from === botId ? `Mandou para ${nameOf(m.to)}: ${m.text}` : `Mensagem de ${nameOf(m.from)}: ${m.text}`;
}

export function botName(team: Pick<TeamBot, 'id' | 'name'>[], id: string): string {
  return team.find((b) => b.id === id)?.name ?? id;
}

export function coerceTeamMessage(raw: unknown): TeamMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.from !== 'string' || typeof r.to !== 'string' || typeof r.text !== 'string') return null;
  if (typeof r.ts !== 'number' || typeof r.hop !== 'number') return null;
  const status = r.status === 'delivered' || r.status === 'queued' || r.status === 'blocked' || r.status === 'failed' ? r.status : null;
  if (!status) return null;
  const m: TeamMessage = { id: r.id, from: r.from, to: r.to, text: r.text, ts: r.ts, status, hop: r.hop };
  if (typeof r.reason === 'string') m.reason = r.reason;
  return m;
}

export const MAX_CLIENT_TEAM_MSGS = 1000;

// Folds a page or a live frame into what the browser holds: one entry per id,
// oldest first, capped so a chatty team cannot grow the tab without bound.
export function mergeTeamMessages(prev: TeamMessage[], items: TeamMessage[], cap = MAX_CLIENT_TEAM_MSGS): TeamMessage[] {
  if (!items.length) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of items) byId.set(m.id, m);
  const all = [...byId.values()].sort((a, b) => a.ts - b.ts);
  return all.length > cap ? all.slice(-cap) : all;
}
