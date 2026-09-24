import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../config';
import { num } from '../sessions/records';
import { broadcast } from './broadcast';
import { threads } from './threads';

// Espelho do terminal pra agentes de FUNDO (Task/Agent lançados em background):
// label + tempo decorrido + gasto de tokens ao vivo, com flip pra "done" no fim.
// Fonte da verdade = os JSONL que o CLI escreve por agente em
// <tmp>/claude-<uid>/<projectSlug>/<sessionId>/tasks/<agentId>.output. Cada linha
// é um stream event; o último assistant com stop_reason terminal (end_turn/
// stop_sequence) marca o fim. Enquanto o arquivo é escrito (mtime fresco) sem
// stop_reason terminal, o agente está rodando.

export interface BgAgent {
  id: string;
  label: string;
  startedAt: number;
  tokens: number; // cumulativo (input+output+cache_creation, SEM cache read — mesma régua do ticker do turno)
  status: 'running' | 'done' | 'failed';
  durationMs: number;
}

// Considera o arquivo "vivo" se foi tocado nesta janela. O watcher só roda
// enquanto há turno principal ativo; mtime fresco distingue um agente em curso de
// um residual de sessão anterior cujo último assistant ficou em 'tool_use'.
export const STALE_MS = 30_000;
const TERMINAL_REASONS = new Set(['end_turn', 'stop_sequence']);

// Deriva um label curto do prompt do Task (1ª mensagem user do agente). Corta na
// 1ª frase/linha e limita o tamanho; cai pro agentId quando não há texto.
export function labelFromPrompt(prompt: string | undefined, agentId: string): string {
  if (typeof prompt !== 'string') return agentId;
  const firstLine = prompt.split('\n')[0]?.trim() ?? '';
  const clipped = firstLine.split(/(?<=[.!?])\s/)[0]?.trim() ?? firstLine;
  const out = (clipped || firstLine).slice(0, 60).trim();
  return out || agentId;
}

// Running totals over the lines seen so far. Kept per file between scans so a
// tick only parses what the CLI appended since the last one.
interface AgentAcc {
  startedAt: number;
  lastTs: number;
  tokens: number;
  terminal: boolean;
  sawAnyText: boolean;
  firstUserPrompt: string | undefined;
}

const newAcc = (): AgentAcc => ({ startedAt: 0, lastTs: 0, tokens: 0, terminal: false, sawAnyText: false, firstUserPrompt: undefined });

function feedLine(acc: AgentAcc, raw: string): void {
  const line = raw.trim();
  if (!line) return;
  let o: any;
  try { o = JSON.parse(line); } catch { return; } // linha parcial (escrevendo)
  const ts = Date.parse(o.timestamp ?? '');
  if (Number.isFinite(ts)) {
    if (!acc.startedAt) acc.startedAt = ts;
    if (ts > acc.lastTs) acc.lastTs = ts;
  }
  const m = o.message;
  if (o.type === 'user' && typeof m?.content === 'string' && acc.firstUserPrompt === undefined) {
    acc.firstUserPrompt = m.content;
  }
  if (o.type === 'assistant' && m && typeof m === 'object') {
    const u = m.usage;
    if (u && typeof u === 'object') {
      acc.tokens += num(u.input_tokens) + num(u.output_tokens) + num(u.cache_creation_input_tokens);
    }
    if (Array.isArray(m.content) && m.content.some((c: any) => c?.type === 'text' && typeof c?.text === 'string' && c.text.trim())) {
      acc.sawAnyText = true;
    }
    const sr = m.stop_reason;
    acc.terminal = typeof sr === 'string' && TERMINAL_REASONS.has(sr);
  }
}

function agentFrom(acc: AgentAcc, agentId: string, mtimeMs: number, now: number): BgAgent | null {
  if (!acc.startedAt) return null; // arquivo vazio/sem evento válido ainda
  const label = labelFromPrompt(acc.firstUserPrompt, agentId);
  const fresh = now - mtimeMs < STALE_MS;
  // Fim = último assistant com stop_reason terminal. Stale-sem-terminal = um run
  // que não escreve mais e nunca fechou (processo morto): trata como falho pra a UI
  // sair do limbo em vez de girar pra sempre.
  let status: BgAgent['status'];
  if (acc.terminal) status = acc.sawAnyText ? 'done' : 'failed';
  else if (fresh) status = 'running';
  else status = 'failed';

  const endTs = acc.lastTs || mtimeMs;
  const durationMs = status === 'running' ? Math.max(0, now - acc.startedAt) : Math.max(0, endTs - acc.startedAt);
  return { id: agentId, label, startedAt: acc.startedAt, tokens: acc.tokens, status, durationMs };
}

// Parser PURO: recebe o conteúdo do .output, o mtime e o relógio. Sem I/O — testável.
export function parseAgentFile(
  agentId: string,
  content: string,
  mtimeMs: number,
  now: number,
): BgAgent | null {
  const acc = newAcc();
  for (const raw of content.split('\n')) feedLine(acc, raw);
  return agentFrom(acc, agentId, mtimeMs, now);
}

// Dir de tasks do CLI: TMPDIR/claude-<uid>/<projectSlug>/<sessionId>/tasks.
export function tasksDir(sessionId: string): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
  return join(tmpdir(), `claude-${uid}`, projectSlug(homedir()), sessionId, 'tasks');
}

// Per file: the totals over every complete line up to `offset`. Agent outputs
// reach tens of MB (18 MB seen) and this runs every 2 s per active thread and
// every 10 s for the Orchestrator panel; reading them whole blocked the event
// loop for 100–400 ms per scan on this box.
interface FileCache { ino: number; size: number; mtimeMs: number; offset: number; acc: AgentAcc; seenAt: number }
// Entries for sessions nobody scans any more (finished threads, a handed-off
// Orchestrator) are dropped after this long.
const CACHE_IDLE_MS = 10 * 60_000;
const fileCache = new Map<string, FileCache>();

function readRange(path: string, from: number, to: number): Buffer {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(to - from);
    let got = 0;
    while (got < buf.length) {
      const n = readSync(fd, buf, got, buf.length - got, from + got);
      if (n === 0) break;
      got += n;
    }
    return buf.subarray(0, got);
  } finally { closeSync(fd); }
}

// Only complete lines advance `offset`; the unfinished tail is parsed on a copy
// (a last line without "\n" still counts, as with a whole-file read) and read
// again next time.
function scanFile(path: string, id: string, now: number): BgAgent | null {
  const st = statSync(path);
  let c = fileCache.get(path);
  // A different inode is a replaced file, even when it is not shorter.
  if (!c || st.ino !== c.ino || st.size < c.offset) c = { ino: st.ino, size: 0, mtimeMs: 0, offset: 0, acc: newAcc(), seenAt: now };
  const buf = st.size > c.offset ? readRange(path, c.offset, st.size) : Buffer.alloc(0);
  const cut = buf.lastIndexOf(0x0a) + 1;
  if (cut > 0) {
    for (const raw of buf.subarray(0, cut).toString('utf8').split('\n')) feedLine(c.acc, raw);
    c.offset += cut;
  }
  c.size = st.size;
  c.mtimeMs = st.mtimeMs;
  c.seenAt = now;
  fileCache.set(path, c);
  let acc = c.acc;
  if (cut < buf.length) { acc = { ...c.acc }; feedLine(acc, buf.subarray(cut).toString('utf8')); }
  return agentFrom(acc, id, st.mtimeMs, now);
}

// Exported for the Orchestrator's "Em andamento" panel (canvas/orchestrator-
// activity.ts): its sessionId is never in `threads` (it's an interactive CLI
// in a tmux pane, not one of our own runs), so scanActiveBgAgents' own
// threads-iteration never reaches it — but the CLI writes the exact same
// tasksDir/*.output files for a Task/Agent launch regardless of who started
// the session, so scanning it directly works the same way.
export function scanSession(sessionId: string, now: number): BgAgent[] {
  const dir = tasksDir(sessionId);
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  const out: BgAgent[] = [];
  const listed = new Set<string>();
  for (const name of names) {
    if (!name.endsWith('.output')) continue;
    const id = name.slice(0, -'.output'.length);
    const path = join(dir, name);
    listed.add(path);
    let a: BgAgent | null;
    try { a = scanFile(path, id, now); } catch { fileCache.delete(path); continue; }
    if (a) out.push(a);
  }
  for (const [path, c] of fileCache) {
    if ((path.startsWith(dir + '/') && !listed.has(path)) || now - c.seenAt > CACHE_IDLE_MS) fileCache.delete(path);
  }
  return out;
}

// Snapshot de TODOS os agentes de fundo das sessões com turno principal ativo.
export function scanActiveBgAgents(now = Date.now()): { sessionKey: string; agents: BgAgent[] }[] {
  const result: { sessionKey: string; agents: BgAgent[] }[] = [];
  for (const [sessionKey, thread] of threads) {
    const sid = thread.sessionId;
    if (!sid) continue;
    const agents = scanSession(sid, now);
    if (agents.length) result.push({ sessionKey, agents });
  }
  return result;
}

// Igualdade barata pra só broadcastar em MUDANÇA (cheap/droppable, como o stats).
export function sameAgents(a: BgAgent[], b: BgAgent[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; const y = b[i];
    if (x.id !== y.id || x.status !== y.status || x.tokens !== y.tokens) return false;
  }
  return true;
}

export function startBgAgentsLoop(hasClients: () => boolean) {
  const last = new Map<string, BgAgent[]>();
  const tick = () => {
    if (!hasClients()) return;
    try {
      const now = Date.now();
      const snaps = scanActiveBgAgents(now);
      const seen = new Set<string>();
      for (const { sessionKey, agents } of snaps) {
        seen.add(sessionKey);
        const prev = last.get(sessionKey);
        if (!prev || !sameAgents(prev, agents)) {
          last.set(sessionKey, agents);
          broadcast({ t: 'bgAgents', sessionKey, agents });
        }
      }
      // Sessão que tinha agentes e agora não tem nenhuma entrada: limpa a faixa.
      for (const sessionKey of last.keys()) {
        if (!seen.has(sessionKey)) {
          last.delete(sessionKey);
          broadcast({ t: 'bgAgents', sessionKey, agents: [] });
        }
      }
    } catch { /* best-effort, igual ao stats loop */ }
  };
  setInterval(tick, 2000).unref();
}
