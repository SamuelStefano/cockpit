import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  type AreaBudget, type AreaId, type CanvasBoard, type CanvasCard, type CanvasFlow, type CanvasPos,
  type CanvasSessionStatus, type CardStatus,
  AREA_IDS, CARD_ID_RE, CARD_STATUSES, CONTENT_FORMATS, FLOW_ID_RE, isFlowEndpoint,
} from '../../shared/canvas';

// Kanban cards + canvas positions for the canvas route. Lives in ~/.cockpit, out
// of the agent's workdir, so the agent never reads it as context by accident.
function boardFile(): string {
  return process.env.COCKPIT_CANVAS_BOARD ?? join(homedir(), '.cockpit', 'canvas-board.json');
}

const MAX_CARDS = 500;
const MAX_POS = 4000;
const MAX_TITLE = 140;
const MAX_PROMPT = 20_000;
const MAX_LINKS = 60;
export const MAX_FLOWS = 100;
const MAX_TEMPLATE = 4000;
const MAX_MCPS = 20;
const MCP_NAME_RE = /^[A-Za-z0-9_-]{1,60}$/;
const FLOW_MODES = new Set(['plan', 'auto', 'acceptEdits']);
const NODE_ID_RE = /^[scktw]:[A-Za-z0-9_-]{1,80}$/;
const REF_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function emptyBoard(): CanvasBoard {
  return { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} };
}

const MAX_TOKENS_BUDGET = 5_000_000; // absurd-guard, not a real ceiling anyone would hit
const MAX_CPU_BUDGET = 100 * 64; // 64 cores pegged, same idea

// Every field optional: a budget with neither number set is meaningless, so it
// is dropped rather than kept as an empty `{}` (readBoard/board.test.ts treat
// "no entry" and "entry with nothing in it" as the same thing on purpose).
export function sanitizeBudget(raw: unknown): AreaBudget {
  const b = (raw ?? {}) as Record<string, unknown>;
  const out: AreaBudget = {};
  if (typeof b.ctxTokens === 'number' && Number.isFinite(b.ctxTokens) && b.ctxTokens > 0) {
    out.ctxTokens = Math.min(Math.round(b.ctxTokens), MAX_TOKENS_BUDGET);
  }
  if (typeof b.cpu === 'number' && Number.isFinite(b.cpu) && b.cpu > 0) {
    out.cpu = Math.min(Math.round(b.cpu), MAX_CPU_BUDGET);
  }
  if (b.autoPause === true) out.autoPause = true;
  return out;
}

export function sanitizeBudgets(raw: unknown): Partial<Record<AreaId, AreaBudget>> {
  const out: Partial<Record<AreaId, AreaBudget>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!AREA_IDS.includes(k as AreaId)) continue;
    const b = sanitizeBudget(v);
    if (Object.keys(b).length) out[k as AreaId] = b;
  }
  return out;
}

// The popover always submits the area's whole budget (all 3 fields at once,
// like sanitizeCard replaces a whole card) — a JSON frame drops an `undefined`
// field entirely, so there is no wire-safe way to express "clear just this
// one" as a patch. Re-sanitized here regardless, never trusted raw. An empty
// result (every field off) removes the entry instead of leaving a `{}` husk.
export function setBudget(board: CanvasBoard, area: string, raw: unknown): CanvasBoard {
  if (!AREA_IDS.includes(area as AreaId)) return board;
  const budgets = { ...board.budgets };
  const next = sanitizeBudget(raw);
  if (Object.keys(next).length) budgets[area as AreaId] = next; else delete budgets[area as AreaId];
  return { ...board, budgets };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const refs = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && REF_RE.test(x)))].slice(0, MAX_LINKS) : []);

// Frames arrive as raw JSON: every field is re-derived here, nothing is trusted.
export function sanitizeCard(raw: unknown, prev: CanvasCard | undefined, now: number): CanvasCard | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  if (typeof c.id !== 'string' || !CARD_ID_RE.test(c.id)) return null;
  const title = str(c.title, MAX_TITLE).replace(/[\r\n]+/g, ' ').trim();
  if (!title) return null;
  const status = CARD_STATUSES.includes(c.status as CanvasCard['status']) ? (c.status as CanvasCard['status']) : 'todo';
  const kind = c.kind === 'content' ? 'content' : 'task';
  const format = kind === 'content' && CONTENT_FORMATS.includes(c.format as never) ? (c.format as CanvasCard['format']) : undefined;
  return {
    id: c.id, title, prompt: str(c.prompt, MAX_PROMPT), status, kind, format,
    contextIds: refs(c.contextIds), sessionIds: refs(c.sessionIds),
    createdAt: prev?.createdAt ?? now, updatedAt: now,
  };
}

const mcpList = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && MCP_NAME_RE.test(x)))].slice(0, MAX_MCPS) : undefined);

// Frames arrive as raw JSON, same rule as sanitizeCard: every field re-derived,
// nothing trusted. from/to are capped to `s:`/`k:` (isFlowEndpoint) and a
// self-loop is rejected outright — firing a flow into its own source would
// never close a turn.
//
// fires/lastFiredAt are SERVER-OWNED: only server/canvas/flows.ts's
// claimFlowFire ever advances them. A client save always carries whatever it
// last read, which could be stale (or, from a compromised/buggy client,
// forged) — trusting it would let a save silently rewind or fast-forward the
// rate limit and the disparo counter. `prev` here must come from the SAME
// updateBoard snapshot the write lands on (see dispatch.ts's canvas-flow-save),
// not a separate readBoard() call, or this only narrows the race, not closes it.
export function sanitizeFlow(raw: unknown, prev: CanvasFlow | undefined, now: number): CanvasFlow | null {
  const f = (raw ?? {}) as Record<string, unknown>;
  if (typeof f.id !== 'string' || !FLOW_ID_RE.test(f.id)) return null;
  if (typeof f.from !== 'string' || !isFlowEndpoint(f.from)) return null;
  if (typeof f.to !== 'string' || !isFlowEndpoint(f.to)) return null;
  if (f.from === f.to) return null;
  const mode = typeof f.mode === 'string' && FLOW_MODES.has(f.mode) ? (f.mode as CanvasFlow['mode']) : undefined;
  const mcps = mcpList(f.mcps);
  return {
    id: f.id, from: f.from, to: f.to, template: str(f.template, MAX_TEMPLATE), enabled: f.enabled !== false,
    createdAt: prev?.createdAt ?? now, fires: prev?.fires ?? 0,
    ...(prev?.lastFiredAt !== undefined ? { lastFiredAt: prev.lastFiredAt } : {}),
    ...(prev?.failStreak ? { failStreak: prev.failStreak } : {}),
    ...(prev?.lastFailedAt !== undefined ? { lastFailedAt: prev.lastFailedAt } : {}),
    ...(mode ? { mode } : {}), ...(mcps ? { mcps } : {}),
  };
}

export function sanitizePos(raw: unknown): Record<string, CanvasPos> {
  const out: Record<string, CanvasPos> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = v as { x?: unknown; y?: unknown };
    if (!NODE_ID_RE.test(k) || !Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
    out[k] = { x: Math.round(p.x as number), y: Math.round(p.y as number) };
  }
  return out;
}

export function upsertCard(board: CanvasBoard, card: CanvasCard): CanvasBoard {
  const i = board.cards.findIndex((c) => c.id === card.id);
  if (i < 0 && board.cards.length >= MAX_CARDS) return board;
  const cards = i < 0 ? [card, ...board.cards] : board.cards.map((c, j) => (j === i ? card : c));
  return { ...board, cards };
}

export function removeCard(board: CanvasBoard, id: string): CanvasBoard {
  const pos = { ...board.pos };
  delete pos[`k:${id}`];
  const nodeId = `k:${id}`;
  return {
    ...board, cards: board.cards.filter((c) => c.id !== id), pos,
    // A flow bound to a card that no longer exists is dead weight at best —
    // at worst it fires into a card the UI can never show, forever failing
    // delivery. Drop it with the card instead of leaving an orphan arrow.
    flows: board.flows.filter((f) => f.from !== nodeId && f.to !== nodeId),
  };
}

// A card a flow just delivered a prompt to: same transition the client makes
// on runCard, done here because the trigger fires with the browser closed.
export function markCardDoing(board: CanvasBoard, cardId: string, now: number): CanvasBoard {
  const i = board.cards.findIndex((c) => c.id === cardId);
  if (i < 0) return board;
  const cards = [...board.cards];
  cards[i] = { ...cards[i], status: 'doing', updatedAt: now };
  return { ...board, cards };
}

export function upsertFlow(board: CanvasBoard, flow: CanvasFlow): CanvasBoard {
  const i = board.flows.findIndex((f) => f.id === flow.id);
  if (i < 0 && board.flows.length >= MAX_FLOWS) return board;
  const flows = i < 0 ? [flow, ...board.flows] : board.flows.map((f, j) => (j === i ? flow : f));
  return { ...board, flows };
}

export type FlowSaveError = 'duplicado' | 'limite';

// Checked BEFORE upsertFlow, inside the same updateBoard snapshot (dispatch.ts):
// a silent no-op on MAX_FLOWS looks like success to the caller, and two arrows
// between the same pair is just visual/functional noise (which one fires?).
export function checkFlowSave(board: CanvasBoard, flow: CanvasFlow): FlowSaveError | null {
  if (board.flows.some((f) => f.id !== flow.id && f.from === flow.from && f.to === flow.to)) return 'duplicado';
  if (!board.flows.some((f) => f.id === flow.id) && board.flows.length >= MAX_FLOWS) return 'limite';
  return null;
}

export function removeFlow(board: CanvasBoard, id: string): CanvasBoard {
  return { ...board, flows: board.flows.filter((f) => f.id !== id) };
}

export interface FlowClaim {
  board: CanvasBoard;
  claimed: boolean;
  // Snapshot from BEFORE the claim, so a failed delivery can restore the
  // EXACT prior state (server/canvas/flows.ts recordFlowFailure) instead of
  // just clearing lastFiredAt — which would erase a real previous fire's
  // timestamp and falsely re-arm the 60s cooldown as "never fired".
  prevFires: number;
  prevLastFiredAt?: number;
  prevFailStreak: number;
}

// Claims the RIGHT to fire, atomically, inside one updateBoard snapshot —
// BEFORE any delivery attempt. `claimed: false` covers every reason another
// concurrent close already got there first: removed, disabled, inside the
// normal cooldown, or inside this flow's own failure backoff window
// (`backoffMs`, injected rather than imported so this module stays generic —
// server/canvas/flows.ts owns the actual curve). server/canvas/flows.ts only
// delivers when claimed.
export function claimFlowFire(
  board: CanvasBoard, id: string, now: number, cooldownMs: number, backoffMs: (failStreak: number) => number,
): FlowClaim {
  const i = board.flows.findIndex((f) => f.id === id);
  if (i < 0) return { board, claimed: false, prevFires: 0, prevLastFiredAt: undefined, prevFailStreak: 0 };
  const f = board.flows[i];
  const prevFailStreak = f.failStreak ?? 0;
  const rateBlocked = f.lastFiredAt !== undefined && now - f.lastFiredAt < cooldownMs;
  const backoffBlocked = prevFailStreak > 0 && f.lastFailedAt !== undefined && now - f.lastFailedAt < backoffMs(prevFailStreak);
  if (!f.enabled || rateBlocked || backoffBlocked) {
    return { board, claimed: false, prevFires: f.fires, prevLastFiredAt: f.lastFiredAt, prevFailStreak };
  }
  const flows = [...board.flows];
  flows[i] = { ...f, lastFiredAt: now, fires: f.fires + 1 };
  return { board: { ...board, flows }, claimed: true, prevFires: f.fires, prevLastFiredAt: f.lastFiredAt, prevFailStreak };
}

// A claimed fire whose delivery then failed (target gone, run didn't start,
// concurrency cap, ...) didn't actually happen — restore the EXACT prior
// fires/lastFiredAt (from claimFlowFire's snapshot) and bump the failure
// streak, which arms the exponential backoff for the NEXT attempt. `claimedAt`
// guards against clobbering a newer legitimate claim that landed while this
// delivery was still in flight.
export function recordFlowFailure(
  board: CanvasBoard, id: string, claimedAt: number, prevFires: number, prevLastFiredAt: number | undefined, now: number,
): CanvasBoard {
  const i = board.flows.findIndex((f) => f.id === id);
  if (i < 0) return board;
  const f = board.flows[i];
  if (f.lastFiredAt !== claimedAt) return board;
  const flows = [...board.flows];
  flows[i] = { ...f, fires: prevFires, lastFiredAt: prevLastFiredAt, failStreak: (f.failStreak ?? 0) + 1, lastFailedAt: now };
  return { ...board, flows };
}

// A delivery that succeeds after a prior failure streak clears it — the next
// failure (if any) starts backoff over from the 1-minute floor, not wherever
// the old streak left off.
export function recordFlowSuccess(board: CanvasBoard, id: string): CanvasBoard {
  const i = board.flows.findIndex((f) => f.id === id);
  if (i < 0 || !board.flows[i].failStreak) return board;
  const flows = [...board.flows];
  flows[i] = { ...flows[i], failStreak: 0, lastFailedAt: undefined };
  return { ...board, flows };
}

// A position map can only grow up to MAX_POS; beyond it the newest write wins
// and the oldest entries fall off, so a runaway client cannot bloat the file.
export function mergePos(board: CanvasBoard, pos: Record<string, CanvasPos>): CanvasBoard {
  const merged = { ...board.pos, ...pos };
  const keys = Object.keys(merged);
  if (keys.length > MAX_POS) for (const k of keys.slice(0, keys.length - MAX_POS)) delete merged[k];
  return { ...board, pos: merged };
}

const MAX_SESSION_STATUS = 2000;

// Same shape as sanitizeCard/sanitizeFlow: raw JSON, nothing trusted. `at` is
// clamped to `now` — a client can't backdate an override to dodge the "a
// newer turn wins" expiry rule (src/routes/canvas/kanban-items.ts
// isOverrideActive) by claiming it happened before a turn that already ran.
export function sanitizeSessionStatus(sessionId: string, raw: unknown, now: number): { sessionId: string; entry: CanvasSessionStatus } | null {
  if (!REF_RE.test(sessionId)) return null;
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!CARD_STATUSES.includes(r.status as CardStatus)) return null;
  const at = typeof r.at === 'number' && Number.isFinite(r.at) ? Math.min(r.at, now) : now;
  return { sessionId, entry: { status: r.status as CardStatus, at } };
}

// One override per session (a new drag replaces the old one outright — no
// history kept); the map is capped like `pos`, oldest insertion evicted first,
// so a runaway client can't bloat the file with session ids that never stop
// accumulating.
export function setSessionStatus(board: CanvasBoard, sessionId: string, entry: CanvasSessionStatus): CanvasBoard {
  const sessionStatus = { ...board.sessionStatus, [sessionId]: entry };
  const keys = Object.keys(sessionStatus);
  if (keys.length > MAX_SESSION_STATUS) for (const k of keys.slice(0, keys.length - MAX_SESSION_STATUS)) delete sessionStatus[k];
  return { ...board, sessionStatus };
}

// Only a missing file means "no board yet" — an unreadable one (EACCES,
// EMFILE) or a corrupt one (JSON parse error after a hand edit) must NOT read
// as empty, because updateBoard would then happily write that emptiness over
// every card and position (canvas review #10).
export async function readBoard(): Promise<CanvasBoard> {
  let raw: string;
  try {
    raw = await readFile(boardFile(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return emptyBoard();
    throw err;
  }
  const parsed = JSON.parse(raw) as Partial<CanvasBoard>; // throws on corrupt JSON, on purpose
  const now = Date.now();
  const cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
    .map((c) => sanitizeCard(c, c as CanvasCard, (c as CanvasCard)?.updatedAt ?? now))
    .filter((c): c is CanvasCard => !!c);
  // A board written before flows/budgets existed has no such key at all —
  // Array.isArray on undefined is false, so flows degrades to [] instead of
  // throwing; sanitizeBudgets does the equivalent for a missing/non-object budgets.
  const flows = (Array.isArray(parsed.flows) ? parsed.flows : [])
    .map((f) => sanitizeFlow(f, f as CanvasFlow, now))
    .filter((f): f is CanvasFlow => !!f);
  // A board written before this feature existed has no `sessionStatus` key at
  // all — degrades to {} instead of throwing, same defense `flows` already has.
  const sessionStatus: Record<string, CanvasSessionStatus> = {};
  if (parsed.sessionStatus && typeof parsed.sessionStatus === 'object') {
    for (const [sid, v] of Object.entries(parsed.sessionStatus as Record<string, unknown>)) {
      const clean = sanitizeSessionStatus(sid, v, now);
      if (clean) sessionStatus[clean.sessionId] = clean.entry;
    }
  }
  return { cards, pos: sanitizePos(parsed.pos), flows, budgets: sanitizeBudgets(parsed.budgets), sessionStatus };
}

// Every write goes through one chain: two quick frames (drag end + card save)
// would otherwise read the same snapshot and the second would drop the first.
// A read failure rejects `next` instead of writing — the caller sees the
// error and nothing on disk changes.
let chain: Promise<unknown> = Promise.resolve();
export function updateBoard(fn: (b: CanvasBoard) => CanvasBoard): Promise<CanvasBoard> {
  const next = chain.then(async () => {
    const updated = fn(await readBoard());
    const f = boardFile();
    await mkdir(dirname(f), { recursive: true });
    await copyFile(f, `${f}.bak`).catch(() => undefined); // best-effort: no prior file yet is fine
    // pid+random, not a bare `.tmp`: the index (loopback) and the agent (relay)
    // are two OS processes that can both be writing this file around the same
    // moment, and a shared temp name lets one process's rename land on top of
    // the other's still-being-written tmp (canvas review — flows batch #14).
    const tmp = `${f}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, JSON.stringify(updated), 'utf8');
    await rename(tmp, f);
    return updated;
  });
  chain = next.catch(() => undefined);
  return next;
}

// A plain `readBoard()` can land between two chained writes and see a
// half-applied state (canvas review #7): `canvas-get` fires concurrently with
// a drag-end or card-save frame, not awaited against them. Reading through
// the same chain — without itself writing anything — waits for whatever
// write is already in flight, same as another updateBoard() would.
export function readBoardChained(): Promise<CanvasBoard> {
  const next = chain.then(() => readBoard());
  chain = next.catch(() => undefined);
  return next;
}
