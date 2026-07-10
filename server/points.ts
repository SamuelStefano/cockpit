import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PointsEvent, PointsEntry, PointsHistoryItem } from '../shared/protocol';

// Ledger de pontuação (story points de tasks). A IA registra os pontos ao terminar
// uma task; o usuário pode CORRIGIR, mas nada é sobrescrito — cada correção é um
// evento APPEND-ONLY. O histórico prevalece. Fica em ~/.cockpit/points.jsonl
// (JSONL, uma linha por evento). Path lido em runtime pra ser testável via COCKPIT_POINTS.
export function pointsFile(): string {
  return process.env.COCKPIT_POINTS ?? join(homedir(), '.cockpit', 'points.jsonl');
}

const MAX_TITLE = 500;
const MAX_DESC = 4000;
const MAX_POINTS = 100_000;
const KINDS: ReadonlySet<PointsEvent['kind']> = new Set(['create', 'correct', 'note', 'delete']);

function validPoints(p: unknown): number {
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0 || n > MAX_POINTS) throw new Error('points inválido (0..100000)');
  return n;
}

// Valida e appenda um evento (uma linha \n). create/correct exigem points válido.
// Cria id/entryId/at ausentes. Strings capadas. mkdir recursivo.
export async function appendPointsEvent(ev: Partial<PointsEvent> & { kind: PointsEvent['kind'] }): Promise<PointsEvent> {
  if (!ev || !KINDS.has(ev.kind)) throw new Error('kind inválido');
  const out: PointsEvent = {
    id: typeof ev.id === 'string' && ev.id ? ev.id : randomUUID(),
    entryId: typeof ev.entryId === 'string' && ev.entryId ? ev.entryId : randomUUID(),
    kind: ev.kind,
    by: ev.by === 'agent' ? 'agent' : 'user',
    at: typeof ev.at === 'number' && Number.isFinite(ev.at) ? ev.at : Date.now(),
  };
  if (typeof ev.title === 'string') out.title = ev.title.slice(0, MAX_TITLE);
  if (typeof ev.description === 'string') out.description = ev.description.slice(0, MAX_DESC);
  if (ev.kind === 'create' || ev.kind === 'correct') out.points = validPoints(ev.points);
  else if (ev.points !== undefined) out.points = validPoints(ev.points);

  const f = pointsFile();
  await mkdir(dirname(f), { recursive: true });
  await appendFile(f, JSON.stringify(out) + '\n', 'utf8');
  return out;
}

// Lê o ledger cru (tolerante: pula linha corrompida/mal-formada).
export async function readPointsLedger(): Promise<PointsEvent[]> {
  let raw: string;
  try { raw = await readFile(pointsFile(), 'utf8'); } catch { return []; }
  const out: PointsEvent[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j = JSON.parse(t);
      if (j && typeof j.entryId === 'string' && typeof j.kind === 'string') out.push(j as PointsEvent);
    } catch { /* linha corrompida: ignora */ }
  }
  return out;
}

interface Acc {
  entryId: string;
  title: string;
  points: number;
  originalPoints: number;
  description?: string;
  createdAt: number;
  updatedAt: number;
  by: 'agent' | 'user';
  deleted: boolean;
  history: PointsHistoryItem[];
}

// PURA: dobra o ledger em entries. points = valor ATUAL (último create/correct);
// originalPoints = o do create; corrected = divergem. Entries deletadas somem do
// resultado (mas o ledger mantém tudo). Ordenado por updatedAt desc. total = soma
// dos points visíveis.
export function foldPoints(events: PointsEvent[]): { entries: PointsEntry[]; total: number } {
  const map = new Map<string, Acc>();
  for (const ev of events) {
    if (!ev || typeof ev.entryId !== 'string' || !KINDS.has(ev.kind)) continue;
    let e = map.get(ev.entryId);
    if (ev.kind === 'create') {
      const pts = Number.isFinite(ev.points as number) ? (ev.points as number) : 0;
      if (!e) {
        e = { entryId: ev.entryId, title: ev.title ?? '', points: pts, originalPoints: pts, description: ev.description, createdAt: ev.at, updatedAt: ev.at, by: ev.by === 'agent' ? 'agent' : 'user', deleted: false, history: [] };
        map.set(ev.entryId, e);
      } else {
        // create repetido pro mesmo id: reancora título/pontos originais.
        e.title = ev.title ?? e.title;
        e.points = pts;
        e.originalPoints = pts;
        if (ev.description !== undefined) e.description = ev.description;
        e.updatedAt = Math.max(e.updatedAt, ev.at);
      }
    } else if (e) {
      if (ev.kind === 'correct' && Number.isFinite(ev.points as number)) e.points = ev.points as number;
      else if (ev.kind === 'note') e.description = ev.description;
      else if (ev.kind === 'delete') e.deleted = true;
      e.updatedAt = Math.max(e.updatedAt, ev.at);
    } else {
      continue; // evento pra entryId desconhecido (sem create): ignora
    }
    e.history.push({ kind: ev.kind, points: ev.points, description: ev.description, by: ev.by === 'agent' ? 'agent' : 'user', at: ev.at });
  }

  const entries: PointsEntry[] = [];
  for (const e of map.values()) {
    if (e.deleted) continue;
    const history = [...e.history].sort((a, b) => a.at - b.at);
    entries.push({
      entryId: e.entryId,
      title: e.title,
      points: e.points,
      originalPoints: e.originalPoints,
      description: e.description,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      by: e.by,
      corrected: e.points !== e.originalPoints,
      history,
      deleted: false,
    });
  }
  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  const total = entries.reduce((s, e) => s + e.points, 0);
  return { entries, total };
}

export async function readPoints(): Promise<{ entries: PointsEntry[]; total: number }> {
  return foldPoints(await readPointsLedger());
}

// Helpers de escrita (appendam evento).
export function createEntry(o: { title: string; points: number; description?: string; by: 'agent' | 'user' }): Promise<PointsEvent> {
  return appendPointsEvent({ kind: 'create', title: o.title, points: o.points, description: o.description, by: o.by });
}
export function correctPoints(entryId: string, points: number, by: 'agent' | 'user' = 'user'): Promise<PointsEvent> {
  return appendPointsEvent({ kind: 'correct', entryId, points, by });
}
export function noteEntry(entryId: string, description: string, by: 'agent' | 'user' = 'user'): Promise<PointsEvent> {
  return appendPointsEvent({ kind: 'note', entryId, description, by });
}
export function deleteEntry(entryId: string, by: 'agent' | 'user' = 'user'): Promise<PointsEvent> {
  return appendPointsEvent({ kind: 'delete', entryId, by });
}
