import type { CanvasCard } from '../../../shared/canvas';

// A kanban card shown as a screen on the Mission Room wall.
export type MissionSize = 'S' | 'M' | 'L';

export interface Mission {
  id: string; // CanvasCard.id
  title: string;
  summary: string; // plain-language "what"; the first line of the prompt while none exists
  why: string; // plain-language "why it matters" ('' until generated)
  description: string; // raw technical card prompt
  size: MissionSize;
  status: 'todo' | 'doing';
  xp: number; // S=10, M=25, L=50
  suggested: boolean; // exactly one mission is suggested when the list is non-empty
  reason: string; // why this one is suggested (empty when not suggested)
}

const SUMMARY_MAX = 90;
const XP: Record<MissionSize, number> = { S: 10, M: 25, L: 50 };
const SIZE_RANK: Record<MissionSize, number> = { S: 0, M: 1, L: 2 };

const clip = (t: string): string => (t.length <= SUMMARY_MAX ? t : `${t.slice(0, SUMMARY_MAX - 1).trimEnd()}…`);

// Fallback while the generated plain summary is missing (generator off, no key, rejected answer).
function summarize(prompt: string, title: string): string {
  for (const raw of prompt.split('\n')) {
    const line = raw.replace(/^[\s#>*\-\d.)]+/, '').trim();
    if (line.length >= 3 && /[\p{L}\p{N}]/u.test(line)) return clip(line);
  }
  return clip(title.trim());
}

const sizeOf = (len: number): MissionSize => (len < 300 ? 'S' : len < 1200 ? 'M' : 'L');

function reasonFor(m: Mission): string {
  if (m.status === 'doing') return 'Already in progress — finish it first';
  if (m.size === 'S') return 'Quick win — smallest task on the board';
  return `Smallest task on the board (${m.size}) — start the oldest one`;
}

const byPriority = (a: Mission, b: Mission, age: Map<string, number>): number =>
  (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1) ||
  SIZE_RANK[a.size] - SIZE_RANK[b.size] ||
  (age.get(a.id) ?? 0) - (age.get(b.id) ?? 0);

export function buildMissions(cards: CanvasCard[], _now: number): Mission[] {
  const age = new Map<string, number>();
  const list: Mission[] = [];
  for (const c of cards) {
    if ((c.status !== 'todo' && c.status !== 'doing') || (c.kind !== 'task' && c.kind !== 'content')) continue;
    const size = sizeOf(c.prompt.length);
    age.set(c.id, c.createdAt);
    list.push({
      id: c.id,
      title: c.plain?.title || c.title,
      summary: c.plain?.what || summarize(c.prompt, c.title),
      why: c.plain?.why ?? '',
      description: c.prompt,
      size, status: c.status, xp: XP[size], suggested: false, reason: '',
    });
  }
  list.sort((a, b) => byPriority(a, b, age));
  if (list.length > 0) {
    // Suggestion order: doing first (finish what is started), else smallest, else oldest.
    // `doing` leads the sort, so the head is exactly that pick.
    const top = list[0];
    top.suggested = true;
    top.reason = reasonFor(top);
  }
  return list;
}
