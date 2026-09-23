import { draftPoints, type DflDraft } from './dfl-drafts';

// Turns staged epics into the note the "criar tasks" agent receives. The agent
// must copy titles/points/refs verbatim — the review already happened on /pontos —
// and report back through `deck-drafts set-status` so the card flips to "criado".

export const DRAFT_NOTE_MAX_BYTES = 8_000;

const fmt = (n: number): string => String(n).replace('.', ',');

function epicBlock(d: DflDraft, pointValue: number): string {
  const pts = draftPoints(d);
  const lines = [`### ${d.title} — ${fmt(pts)} pt (R$ ${fmt(Math.round(pts * pointValue * 100) / 100)}) [rascunho ${d.id}]`];
  for (const t of d.tasks) {
    const refs = t.refs.length ? ` — ${t.refs.join(', ')}` : '';
    lines.push(`- ${t.title}${refs} — ${fmt(t.points)} pt`);
  }
  return lines.join('\n');
}

export function serializeDraftsNote(drafts: DflDraft[], pointValue: number): string {
  const ids = drafts.map((d) => d.id).join(' ');
  const header = [
    'Estrutura JÁ REVISADA pelo Samuel no Deck (/pontos → Rascunhos para o DFL). Crie exatamente isto, sem repontuar nem renomear:',
    '- Um épico por bloco abaixo, com o título exato.',
    '- Uma delivery por épico; owner Samuel.',
    '- Uma task por linha, título e pontos exatos, status done (tudo já mergeado); cite os refs de PR no context.',
    `- Ao terminar cada épico, rode \`~/bin/deck-drafts set-status <id-do-rascunho> created\` (ids: ${ids}).`,
  ].join('\n');
  return [header, ...drafts.map((d) => epicBlock(d, pointValue))].join('\n\n');
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

// Packs epics into as few notes as fit the server's note limit: "Criar todos"
// then fires one agent per batch instead of one per epic (the box has 3.7 GB).
export function batchDraftNotes(drafts: DflDraft[], pointValue: number, maxBytes = DRAFT_NOTE_MAX_BYTES): DflDraft[][] {
  const batches: DflDraft[][] = [];
  let cur: DflDraft[] = [];
  for (const d of drafts) {
    const next = [...cur, d];
    if (cur.length && bytes(serializeDraftsNote(next, pointValue)) > maxBytes) {
      batches.push(cur);
      cur = [d];
    } else {
      cur = next;
    }
  }
  if (cur.length) batches.push(cur);
  return batches;
}
