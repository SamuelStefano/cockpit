import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  type CanvasBoard, type CanvasCard, type CanvasPos, CARD_ID_RE, CARD_STATUSES, CONTENT_FORMATS,
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
const NODE_ID_RE = /^[sck]:[A-Za-z0-9_-]{1,80}$/;
const REF_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function emptyBoard(): CanvasBoard {
  return { cards: [], pos: {} };
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
  return { cards: board.cards.filter((c) => c.id !== id), pos };
}

// A position map can only grow up to MAX_POS; beyond it the newest write wins
// and the oldest entries fall off, so a runaway client cannot bloat the file.
export function mergePos(board: CanvasBoard, pos: Record<string, CanvasPos>): CanvasBoard {
  const merged = { ...board.pos, ...pos };
  const keys = Object.keys(merged);
  if (keys.length > MAX_POS) for (const k of keys.slice(0, keys.length - MAX_POS)) delete merged[k];
  return { ...board, pos: merged };
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
  return { cards, pos: sanitizePos(parsed.pos) };
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
    const tmp = `${f}.tmp`;
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
