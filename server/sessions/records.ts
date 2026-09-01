import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import type { Message } from '../../shared/protocol';
import { CONFIG } from '../config';
import { toolResultOutput } from './tool-views';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface Rec {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  logicalParentUuid?: string | null;
  message?: { role: string; content: unknown; usage?: Usage; model?: string; id?: string };
  leafUuid?: string;
  timestamp?: string;
  isCompactSummary?: boolean;
  isMeta?: boolean;
}

// Resultado de tool extraído de um record user com tool_result, indexado por
// tool_use_id pra parear com o tool_use do assistant correspondente.
export interface ToolResultRec {
  output: string[];
  isErr: boolean;
  ts?: number;
}

// JSONL é não-confiável: um campo de usage pode vir string/NaN/Infinity/negativo
// e contaminar o HUD de custo e o INSERT no SQLite (squad High-2). Coage pra
// inteiro finito >= 0; qualquer coisa fora disso vira 0.
export function num(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Tokens de contexto "em voo" no último turno = entrada + cache (o que foi
// enviado ao modelo). Aproxima o quanto da janela de contexto está ocupado.
export function ctxTokens(u?: Usage): number {
  if (!u) return 0;
  return num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens);
}

export function recTs(r: Rec): number | undefined {
  const t = r.timestamp ? Date.parse(r.timestamp) : NaN;
  return Number.isFinite(t) ? t : undefined;
}

// Os tool_results chegam como records USER (content: [{type:'tool_result',...}])
// no turno seguinte ao tool_use. Sem coletá-los, todo card de tool do histórico
// aparecia "done 0.0s" sem saída nenhuma (bug reportado: terminal mostra o curl,
// app mostra card vazio). Mesma extração do closeTool ao vivo.
export function collectToolResults(r: Rec, map: Map<string, ToolResultRec>): void {
  if (r.type !== 'user' || !Array.isArray(r.message?.content)) return;
  const ts = recTs(r);
  for (const c of r.message.content as any[]) {
    if (c?.type !== 'tool_result' || typeof c.tool_use_id !== 'string' || !c.tool_use_id) continue;
    map.set(c.tool_use_id, { output: toolResultOutput(c), isErr: !!c.is_error, ts });
  }
}

// Registros que o terminal mostra e o app perdia: pr-link (sem uuid — dedup por
// URL, fica a 1ª ocorrência) e o wakeup de loop agendado. Viram divisores finos
// tecidos na timeline por timestamp (weaveByTs).
export function markerFromRec(r: Rec, seenPr: Set<string>): Message | null {
  const o = r as unknown as Record<string, unknown>;
  const ts = recTs(r);
  if (r.type === 'pr-link' && typeof o.prUrl === 'string' && o.prUrl) {
    if (seenPr.has(o.prUrl)) return null;
    seenPr.add(o.prUrl);
    const num = typeof o.prNumber === 'number' ? `#${o.prNumber}` : '';
    const repo = typeof o.prRepository === 'string' ? o.prRepository : '';
    return { id: `pr-${o.prUrl}`, role: 'compact', kind: 'pr', label: `PR ${num}${repo ? ` · ${repo}` : ''}`.trim(), url: o.prUrl, ts };
  }
  if (r.type === 'system' && (o as any).subtype === 'scheduled_task_fire' && typeof o.content === 'string') {
    return { id: r.uuid ?? `wake-${ts ?? 0}`, role: 'compact', kind: 'wakeup', label: o.content as string, ts };
  }
  return null;
}

// Resolve o caminho do JSONL com validação anti-traversal (squad High-1).
export function sessionPath(sessionId: string): string | null {
  if (!UUID_RE.test(sessionId)) return null;
  const p = resolve(join(CONFIG.projectsDir, `${sessionId}.jsonl`));
  if (!p.startsWith(resolve(CONFIG.projectsDir))) return null;
  return p;
}

export interface RecordScan {
  // TODO record com uuid: o parentUuid de user/assistant pode apontar pra um nó
  // intermediário (attachment/system) — indexar só user/assistant quebra a
  // caminhada no 1º intermediário e trunca o histórico (squad).
  byUuid: Map<string, Rec>;
  msgs: Rec[]; // só user/assistant, na ordem do arquivo
  results: Map<string, ToolResultRec>;
  markers: Message[];
  leaf?: string;        // último last-prompt.leafUuid = folha da cadeia ativa
  lastMsgUuid?: string; // último user/assistant do arquivo
}

// Passada única sobre o JSONL. Os dois consumidores (cadeia ativa e timeline
// completa) liam o arquivo com loops quase idênticos que já divergiram uma vez —
// o da timeline não capturava o leaf e o outro não guardava a lista linear.
export async function readRecords(path: string): Promise<RecordScan> {
  const scan: RecordScan = { byUuid: new Map(), msgs: [], results: new Map(), markers: [] };
  const seenPr = new Set<string>();
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r.type === 'last-prompt' && r.leafUuid) scan.leaf = r.leafUuid;
    collectToolResults(r, scan.results);
    if (r.uuid) scan.byUuid.set(r.uuid, r);
    if (r.uuid && (r.type === 'user' || r.type === 'assistant')) {
      scan.msgs.push(r);
      scan.lastMsgUuid = r.uuid;
    }
    const marker = markerFromRec(r, seenPr);
    if (marker) scan.markers.push(marker);
  }
  return scan;
}

function descendsFrom(byUuid: Map<string, Rec>, node: string, ancestor: string): boolean {
  const guard = new Set<string>();
  let cur: string | undefined = node;
  while (cur && byUuid.has(cur) && !guard.has(cur)) {
    if (cur === ancestor) return true;
    guard.add(cur);
    const r: Rec = byUuid.get(cur)!;
    cur = r.parentUuid ?? r.logicalParentUuid ?? undefined;
  }
  return false;
}

// Caminho ativo (user/assistant em ordem raiz→folha) a partir do leaf. O leaf vem
// do last-prompt.leafUuid, MAS ele pode apontar pra um uuid que não é record local
// (resume cross-file / folha podada): nesse caso a caminhada nem entra e o
// histórico voltaria VAZIO. Cai pro último user/assistant quando o leaf não existe.
export function activeChain(byUuid: Map<string, Rec>, leaf: string | undefined, lastMsgUuid: string | undefined): Rec[] {
  if (!leaf || !byUuid.has(leaf)) leaf = lastMsgUuid ?? [...byUuid.keys()].pop();
  // O last-prompt só é reescrito quando um prompt novo entra: no meio do turno o
  // leafUuid fica defasado e amputa a cauda (texto final, pergunta, resultado).
  // Se o último user/assistant descende do leaf, ele é a folha real do mesmo ramo.
  else if (lastMsgUuid && lastMsgUuid !== leaf && descendsFrom(byUuid, lastMsgUuid, leaf)) leaf = lastMsgUuid;
  const chain: Rec[] = [];
  let cur: string | undefined = leaf;
  const guard = new Set<string>();
  while (cur && byUuid.has(cur) && !guard.has(cur)) {
    guard.add(cur);
    const r = byUuid.get(cur)!;
    if (r.type === 'user' || r.type === 'assistant') chain.push(r);
    // Na compactação o CLI corta o fio: o record `compact_boundary` nasce com
    // parentUuid null e guarda o elo real em logicalParentUuid. Sem seguir esse
    // elo a caminhada morria ali e TUDO antes da compactação — inclusive o
    // prompt que abriu o turno — sumia da thread.
    cur = r.parentUuid ?? r.logicalParentUuid ?? undefined;
  }
  chain.reverse();
  return chain;
}

// Último assistant com usage = contexto corrente da sessão.
export function lastCtxTokens(recs: Rec[]): number {
  for (let i = recs.length - 1; i >= 0; i--) {
    if (recs[i].type === 'assistant' && recs[i].message?.usage) return ctxTokens(recs[i].message!.usage);
  }
  return 0;
}
