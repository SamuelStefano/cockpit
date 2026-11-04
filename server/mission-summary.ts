import type { CanvasBoard, CanvasCard, CardPlain } from '../shared/canvas';
import { CONFIG } from './config';
import { apiKey } from './summary';
import { allMissionPlain, setMissionPlain } from './db';
import { emitCanvasMsg } from './ws/canvas-clients';

// Plain-language rewrite of kanban cards for the Base Mission Room. Card prompts
// are written for AI agents; this asks haiku (same direct-API pattern as
// summary.ts) for a title / what / why a non-technical reader can follow.
// Best-effort: no key, network error or a bad answer just leaves the card
// without `plain` (the client shows a placeholder) — it never throws.

const INPUT_CAP = 4000;
const MAX_CONCURRENT = 5;
const FAIL_RETRY_MS = 10 * 60_000;
export const LIMITS = { titleWords: 6, whatWords: 18, whyWords: 15 } as const;

const INSTRUCTION =
  'Você reescreve tarefas técnicas para uma pessoa leiga. Leia a tarefa abaixo (escrita para um agente de IA) e responda ' +
  'SOMENTE com um JSON válido, em português, neste formato: ' +
  '{"title": "...", "what": "...", "why": "..."}. ' +
  'title: título curto e simples, no máximo 6 palavras. ' +
  'what: UMA frase de no máximo 18 palavras dizendo o que vai existir ou mudar quando estiver pronto. ' +
  'why: UMA frase de no máximo 15 palavras dizendo por que isso importa. ' +
  'Sem jargão, sem nomes de arquivos, sem siglas. Escreva como se explicasse a alguém que não programa.';

export function missionPlainPrompt(card: Pick<CanvasCard, 'title' | 'prompt'>): string {
  const body = `Título: ${card.title}\n\n${card.prompt}`.slice(0, INPUT_CAP);
  return `${INSTRUCTION}\n\n---\n${body}`;
}

const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;

// Pure: pulls the JSON object out of the model text (tolerates ``` fences and
// chatter around it) and rejects anything over the word limits.
export function parseMissionPlain(raw: string): CardPlain | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: unknown;
  try { o = JSON.parse(m[0]); } catch { return null; }
  const r = o as Record<string, unknown>;
  const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  const title = clean(r.title);
  const what = clean(r.what);
  const why = clean(r.why);
  if (!title || !what || !why) return null;
  if (words(title) > LIMITS.titleWords || words(what) > LIMITS.whatWords || words(why) > LIMITS.whyWords) return null;
  return { title, what, why };
}

export function parseMissionPlainResponse(json: unknown): CardPlain | null {
  const blocks = (json as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(blocks)) return null;
  return parseMissionPlain(blocks.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join(' '));
}

// Pure: cards that need a (re)generation — open cards whose cache is missing or
// describes an older revision.
export function needsPlain(
  cards: CanvasCard[],
  cache: Map<string, { cardUpdatedAt: number }>,
  failedAt: Map<string, number>,
  now: number,
): CanvasCard[] {
  return cards.filter((c) => {
    if (c.status !== 'todo' && c.status !== 'doing') return false;
    if (c.kind !== 'task' && c.kind !== 'content') return false;
    if (!c.prompt.trim() && !c.title.trim()) return false;
    if (cache.get(c.id)?.cardUpdatedAt === c.updatedAt) return false;
    const f = failedAt.get(`${c.id}:${c.updatedAt}`);
    return f === undefined || now - f >= FAIL_RETRY_MS;
  });
}

async function callAnthropic(key: string, card: CanvasCard): Promise<CardPlain | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.summaryModel,
      max_tokens: 300,
      messages: [{ role: 'user', content: missionPlainPrompt(card) }],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  return parseMissionPlainResponse(await res.json());
}

const inFlight = new Set<string>();
const failedAt = new Map<string, number>();

// Attaches cached `plain` to the open cards of an outgoing board and lazily kicks
// off generation for the missing/stale ones. Sync and cheap on the hot path.
export function withPlain(board: CanvasBoard): CanvasBoard {
  if (!CONFIG.summaryEnabled) return board;
  try {
    const cache = allMissionPlain();
    const cards = board.cards.map((c) => {
      const row = cache.get(c.id);
      return row && row.cardUpdatedAt === c.updatedAt
        ? { ...c, plain: { title: row.title, what: row.what, why: row.why } }
        : c;
    });
    queueMissionPlain(board.cards, cache);
    return { ...board, cards };
  } catch {
    return board;
  }
}

function queueMissionPlain(cards: CanvasCard[], cache: ReturnType<typeof allMissionPlain>): void {
  const key = apiKey();
  if (!key) return;
  const now = Date.now();
  const todo = needsPlain(cards, cache, failedAt, now).filter((c) => !inFlight.has(`${c.id}:${c.updatedAt}`));
  const queue = [...todo];
  const worker = async (): Promise<void> => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const tag = `${c.id}:${c.updatedAt}`;
      if (inFlight.has(tag)) continue;
      inFlight.add(tag);
      try {
        const plain = await callAnthropic(key, c);
        if (!plain) { failedAt.set(tag, Date.now()); continue; }
        setMissionPlain({ cardId: c.id, cardUpdatedAt: c.updatedAt, ...plain });
        emitCanvasMsg({ t: 'canvas-card-plain', cardId: c.id, cardUpdatedAt: c.updatedAt, plain });
      } catch {
        failedAt.set(tag, Date.now());
      } finally {
        inFlight.delete(tag);
      }
    }
  };
  for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) void worker();
}
