export const SALA_W = 1000;
export const SALA_H = 640;

const CX = 500;
const CY = 300;
export const SALA_CENTER = { x: CX, y: CY };
const RING_BOT = 198;
const RING_CHAT = 292;
const RECENT_MS = 20 * 60 * 1000;
const MAX_CHATS = 8;

export type SalaPulse = 'idle' | 'working' | 'waiting' | 'error';

export const PULSE_LABEL: Record<SalaPulse, string> = {
  idle: 'à toa',
  working: 'em campo',
  waiting: 'espera você',
  error: 'travou',
};

export interface SalaBot {
  id: string;
  name: string;
  label: string;
  color: string;
  parentId?: string;
  primary?: boolean;
  sessionId?: string;
}

export interface SalaSession {
  id: string;
  title: string;
  snippet: string;
  mtime: number;
  waiting?: boolean;
  lastTurnOk?: boolean;
}

export interface SalaNode {
  id: string;
  kind: 'bot' | 'chat';
  title: string;
  subtitle: string;
  detail: string;
  pulse: SalaPulse;
  x: number;
  y: number;
  color: string;
  sessionId?: string;
  botId?: string;
}

export interface SalaEdge {
  from: string;
  to: string;
  live: boolean;
}

export interface SalaModel {
  nodes: SalaNode[];
  edges: SalaEdge[];
  working: number;
  waiting: number;
}

export function pulseOf(running: boolean, waiting?: boolean, lastTurnOk?: boolean): SalaPulse {
  if (running) return 'working';
  if (waiting) return 'waiting';
  if (lastTurnOk === false) return 'error';
  return 'idle';
}

function ringAt(index: number, count: number, radius: number): { x: number; y: number } {
  const turn = count <= 0 ? 0 : (index / count) * Math.PI * 2;
  const angle = -Math.PI / 2 + turn;
  return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function buildSala(input: {
  bots: SalaBot[];
  sessions: SalaSession[];
  running: ReadonlySet<string>;
  now: number;
}): SalaModel {
  const byId = new Map(input.sessions.map((s) => [s.id, s]));
  const bound = new Set(input.bots.map((b) => b.sessionId).filter((id): id is string => !!id));
  const center = input.bots.find((b) => b.primary) ?? input.bots[0];
  const others = input.bots.filter((b) => b !== center);
  const nodes: SalaNode[] = [];
  const edges: SalaEdge[] = [];

  if (center) {
    const session = center.sessionId ? byId.get(center.sessionId) : undefined;
    nodes.push({
      id: `bot:${center.id}`,
      kind: 'bot',
      title: center.name,
      subtitle: center.label,
      detail: session?.snippet ?? '',
      pulse: pulseOf(!!center.sessionId && input.running.has(center.sessionId), session?.waiting, session?.lastTurnOk),
      x: CX,
      y: CY,
      color: center.color,
      sessionId: center.sessionId,
      botId: center.id,
    });
  }

  others.forEach((bot, index) => {
    const session = bot.sessionId ? byId.get(bot.sessionId) : undefined;
    const pos = ringAt(index, others.length, RING_BOT);
    const pulse = pulseOf(!!bot.sessionId && input.running.has(bot.sessionId), session?.waiting, session?.lastTurnOk);
    nodes.push({
      id: `bot:${bot.id}`,
      kind: 'bot',
      title: bot.name,
      subtitle: bot.label,
      detail: session?.snippet ?? '',
      pulse,
      x: pos.x,
      y: pos.y,
      color: bot.color,
      sessionId: bot.sessionId,
      botId: bot.id,
    });
  });

  for (const bot of others) {
    const parentId = bot.parentId ?? center?.id;
    if (!parentId || parentId === bot.id) continue;
    const parent = `bot:${parentId}`;
    if (!nodes.some((n) => n.id === parent)) continue;
    const pulse = nodes.find((n) => n.id === `bot:${bot.id}`)?.pulse;
    edges.push({ from: parent, to: `bot:${bot.id}`, live: pulse === 'working' });
  }

  const chats = input.sessions
    .filter((s) => !bound.has(s.id))
    .filter((s) => input.running.has(s.id) || s.waiting || input.now - s.mtime < RECENT_MS)
    .sort((a, b) => Number(input.running.has(b.id)) - Number(input.running.has(a.id)) || Number(!!b.waiting) - Number(!!a.waiting) || b.mtime - a.mtime)
    .slice(0, MAX_CHATS);

  chats.forEach((session, index) => {
    const pos = ringAt(index, chats.length, RING_CHAT);
    const pulse = pulseOf(input.running.has(session.id), session.waiting, session.lastTurnOk);
    nodes.push({
      id: `chat:${session.id}`,
      kind: 'chat',
      title: clip(session.title || 'chat', 28),
      subtitle: 'chat',
      detail: session.snippet,
      pulse,
      x: pos.x,
      y: pos.y,
      color: pulse === 'working' ? '#fb923c' : '#a3a3a3',
      sessionId: session.id,
    });
    if (center) edges.push({ from: `bot:${center.id}`, to: `chat:${session.id}`, live: pulse === 'working' });
  });

  return {
    nodes,
    edges,
    working: nodes.filter((n) => n.pulse === 'working').length,
    waiting: nodes.filter((n) => n.pulse === 'waiting').length,
  };
}
