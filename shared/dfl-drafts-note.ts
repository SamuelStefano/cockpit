import { deliveryTasks, draftPoints, type DflDraft, type DflDraftTask } from './dfl-drafts';

// Turns staged work into the note the "criar no DFL" agent receives. A unit is a
// whole epic or a subset of its tasks (one delivery, a selection). The agent must
// copy titles/points/refs verbatim — the review already happened on /pontos — and
// report back through `deck-drafts set-status` so the Deck flips what it created.

export const DRAFT_NOTE_MAX_BYTES = 8_000;

export interface DispatchUnit {
  draft: DflDraft;
  taskIds?: string[];   // absent = the whole epic
}

const fmt = (n: number): string => String(n).replace('.', ',');
const money = (pts: number, pv: number): string => fmt(Math.round(pts * pv * 100) / 100);

function picked(u: DispatchUnit): (t: DflDraftTask) => boolean {
  if (!u.taskIds) return () => true;
  const s = new Set(u.taskIds);
  return (t) => s.has(t.id);
}

// Deliveries of the unit with only the chosen tasks; empty ones are skipped.
export function unitDeliveries(u: DispatchUnit): { id: string; title: string; tasks: DflDraftTask[]; whole: boolean }[] {
  const keep = picked(u);
  return u.draft.deliveries
    .map((dl) => {
      const all = deliveryTasks(u.draft, dl.id);
      const tasks = all.filter(keep);
      return { id: dl.id, title: dl.title, tasks, whole: tasks.length === all.length };
    })
    .filter((x) => x.tasks.length > 0);
}

export function unitTasks(u: DispatchUnit): DflDraftTask[] {
  return unitDeliveries(u).flatMap((x) => x.tasks);
}

// The ids the agent reports back: the epic when it goes whole, else each whole
// delivery, else the loose tasks. Shortest list that covers exactly the unit.
export function unitMarks(u: DispatchUnit): string[] {
  if (!u.taskIds) return [u.draft.id];
  return unitDeliveries(u).flatMap((x) => (x.whole ? [x.id] : x.tasks.map((t) => t.id)));
}

function unitBlock(u: DispatchUnit, pointValue: number): string {
  const dls = unitDeliveries(u);
  const pts = draftPoints({ tasks: dls.flatMap((x) => x.tasks) });
  const part = u.taskIds ? ` — parte do rascunho (${dls.reduce((s, x) => s + x.tasks.length, 0)} de ${u.draft.tasks.length} tasks)` : '';
  const lines = [`### ${u.draft.title} — ${fmt(pts)} pt (R$ ${money(pts, pointValue)}) [rascunho ${u.draft.id}]${part}`];
  for (const dl of dls) {
    lines.push(`#### ${dl.title} — ${fmt(draftPoints(dl))} pt [${dl.id}]`);
    for (const t of dl.tasks) lines.push(`- ${t.title}${t.refs.length ? ` — ${t.refs.join(', ')}` : ''} — ${fmt(t.points)} pt`);
  }
  return lines.join('\n');
}

export function serializeDispatchNote(units: DispatchUnit[], pointValue: number): string {
  const marks = units.flatMap(unitMarks).join(',');
  const header = [
    'Estrutura JÁ REVISADA pelo Samuel no Deck (/pontos). Crie no DFL exatamente isto, sem repontuar nem renomear:',
    '- "###" = épico, com o título exato. Antes de criar, rode list_epics: se já existir épico com esse título (parte dele pode ter sido criada antes), reuse-o em vez de duplicar.',
    '- "####" = delivery desse épico, com o título exato; owner Samuel. Mesma regra: se já existir no épico, reuse.',
    '- Cada "-" = uma task, título e pontos exatos, status done (tudo já mergeado); cite os refs de PR no context.',
    `- Ao terminar, rode \`~/bin/deck-drafts set-status ${marks} created\`.`,
  ].join('\n');
  return [header, ...units.map((u) => unitBlock(u, pointValue))].join('\n\n');
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

// Packs units into as few notes as fit the server's note limit: "criar tudo" then
// fires one agent per batch instead of one per epic (the box has 3.7 GB).
export function batchDispatchNotes(units: DispatchUnit[], pointValue: number, maxBytes = DRAFT_NOTE_MAX_BYTES): DispatchUnit[][] {
  const batches: DispatchUnit[][] = [];
  let cur: DispatchUnit[] = [];
  for (const u of units) {
    const next = [...cur, u];
    if (cur.length && bytes(serializeDispatchNote(next, pointValue)) > maxBytes) {
      batches.push(cur);
      cur = [u];
    } else {
      cur = next;
    }
  }
  if (cur.length) batches.push(cur);
  return batches;
}
