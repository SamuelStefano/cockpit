import type { Block } from '../../data/types';
import type { NarrationNote, ShownMessage } from './shown';
import { isQuestionTool } from './visible-blocks';

// Uma nota solta continua inline: a caixa só compensa quando o turno realmente
// tagarela. Abaixo disso o clique pra abrir custa mais que a linha economizada.
const MIN_NOTES = 2;

// Bastidor é prosa curta e sem estrutura ("agora vou abrir a PR"). Título, lista,
// tabela, bloco de código ou link são entrega — o turno que escreve o relatório e
// só depois assina "Pronto." esconderia o relatório se fosse só "o último ganha".
const MAX_NOTE_CHARS = 500;
const STRUCTURED = /(^|\n)\s*(#{1,6} |[-*+] |\d+[.)] |> |\||```)/;

const cardCache = new WeakMap<ShownMessage, ShownMessage>();
const prunedCache = new WeakMap<ShownMessage, ShownMessage>();

// Um turno agêntico longo escreve dezenas de linhas do tipo "agora vou abrir a
// PR" / "lendo o README pra achar o lugar certo". Elas contam a história do
// trabalho, mas ninguém lê: o que importa é o texto final. Aqui esse bastidor sai
// das bolhas e vira UMA caixa fechada, ancorada onde a tagarelice começou. Fecha o
// par com collapseTurnTools: a thread vira prompt → ações → notas → resposta.
export function collapseTurnNarration(messages: ShownMessage[], on: boolean): ShownMessage[] {
  if (!on) return messages;
  const cards = new Map<number, NarrationNote[]>();
  const pull = new Map<number, Set<number>>();

  for (const [start, end] of turnRanges(messages)) {
    // Turno em voo nunca colapsa: a caixa nasceria no meio da leitura e o texto
    // sumiria debaixo dela. Concluído = a bolha do fim recebeu as stats do
    // `result`. Posição não serve como prova: dá pra enfileirar um prompt novo com
    // o turno rodando, e aí a bolha viva deixa de ser a última da thread.
    if (!settled(messages[end - 1])) continue;
    // O último texto do turno é a resposta; do resto, só o que parece bastidor.
    const notes = textHits(messages, start, end).slice(0, -1).filter((h) => isNarration(h.md));
    if (notes.length < MIN_NOTES) continue;
    cards.set(notes[0].mi, notes.map(noteOf));
    for (const h of notes) {
      const set = pull.get(h.mi) ?? new Set<number>();
      set.add(h.bi);
      pull.set(h.mi, set);
    }
  }
  if (!cards.size) return messages;

  const out: ShownMessage[] = [];
  const last = messages.length - 1;
  messages.forEach((m, i) => {
    const notes = cards.get(i);
    if (notes) out.push(cardFor(m, notes));
    const drop = pull.get(i);
    if (!drop || m.role !== 'assistant') { out.push(m); return; }
    const kept = m.blocks.filter((_, bi) => !drop.has(bi));
    // Guarda: o texto final do turno nunca é puxado, então a bolha não deveria
    // esvaziar. Se esvaziar, a última fica mesmo assim — é ela que ancora o
    // indicador de pensamento e o "Pensou por X".
    if (kept.length || i === last) out.push(prune(m, kept));
  });
  return out;
}

interface Hit { mi: number; bi: number; md: string; id: string; ts?: number }

function settled(last: ShownMessage | undefined): boolean {
  return !!last && last.role === 'assistant' && !!last.stats;
}

// Prompt do usuário e wakeup do /loop abrem turno novo; a bolha que recebeu as
// stats do `result` FECHA o turno. Sem esse fecho a sessão de /loop viraria um
// turno só (o CLI grava os wakeups como user isMeta, que o parse descarta) e a
// noite inteira colapsaria numa caixa. Divisor de compactação não fecha nada — um
// turno de uma hora auto-compacta várias vezes e continua sendo um turno.
function turnRanges(messages: ShownMessage[]): [number, number][] {
  const ranges: [number, number][] = [];
  let start = 0;
  messages.forEach((m, i) => {
    const opensNext = m.role === 'user' || (m.role === 'compact' && m.kind === 'wakeup');
    const closesHere = m.role === 'assistant' && !!m.stats;
    if (!opensNext && !closesHere) return;
    const end = opensNext ? i : i + 1;
    if (end > start) ranges.push([start, end]);
    start = opensNext ? i + 1 : end;
  });
  if (start < messages.length) ranges.push([start, messages.length]);
  return ranges;
}

// Ao vivo o turno inteiro se acumula numa bolha só ([texto, tool, texto, tool…]),
// no histórico cada resposta da API é uma mensagem. Achatar os blocos de texto do
// trecho resolve as duas formas com a mesma regra.
function textHits(messages: ShownMessage[], start: number, end: number): Hit[] {
  const hits: Hit[] = [];
  for (let mi = start; mi < end; mi++) {
    const m = messages[mi];
    // Bolha de erro (habilita o "tentar novamente") e resposta-rápida de
    // subagente são respostas por si — nunca viram bastidor. Onde há pergunta, o
    // texto ao redor explica as opções e tem que ficar colado no card.
    if (m.role !== 'assistant' || m.error || m.quick || m.digest) continue;
    if (m.blocks.some((b) => b.type === 'tool' && isQuestionTool(b.tool))) continue;
    m.blocks.forEach((b: Block, bi) => {
      if (b.type === 'text' && b.md.trim()) hits.push({ mi, bi, md: b.md, id: `${m.id}:${bi}`, ts: m.ts });
    });
  }
  return hits;
}

function isNarration(md: string): boolean {
  const t = md.trim();
  return t.length <= MAX_NOTE_CHARS && !STRUCTURED.test(t) && !t.includes('](');
}

function noteOf(h: Hit): NarrationNote {
  return { id: h.id, md: h.md, ts: h.ts };
}

function cardFor(anchor: ShownMessage, notes: NarrationNote[]): ShownMessage {
  const hit = cardCache.get(anchor);
  if (hit && sameNotes(hit.narration!, notes)) return hit;
  const node: ShownMessage = { id: `notes:${anchor.id}`, role: 'assistant', blocks: [], narration: notes, ts: anchor.ts };
  cardCache.set(anchor, node);
  return node;
}

function prune(m: Extract<ShownMessage, { role: 'assistant' }>, kept: Block[]): ShownMessage {
  const hit = prunedCache.get(m);
  if (hit && hit.role === 'assistant' && sameBlocks(hit.blocks, kept)) return hit;
  const node: ShownMessage = { ...m, blocks: kept };
  prunedCache.set(m, node);
  return node;
}

function sameNotes(a: NarrationNote[], b: NarrationNote[]): boolean {
  return a.length === b.length && a.every((n, i) => n.id === b[i].id && n.md === b[i].md);
}

function sameBlocks(a: Block[], b: Block[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
