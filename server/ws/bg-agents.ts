import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../config';
import { num } from '../sessions/parse';
import { broadcast } from './broadcast';
import { threads } from './runs';

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

// Parser PURO: recebe o conteúdo do .output, o mtime e o relógio. Sem I/O — testável.
export function parseAgentFile(
  agentId: string,
  content: string,
  mtimeMs: number,
  now: number,
): BgAgent | null {
  let startedAt = 0;
  let lastTs = 0;
  let tokens = 0;
  let label = agentId;
  let terminal = false;
  let sawAnyText = false;
  let firstUserPrompt: string | undefined;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; } // linha parcial (escrevendo)
    const ts = Date.parse(o.timestamp ?? '');
    if (Number.isFinite(ts)) {
      if (!startedAt) startedAt = ts;
      if (ts > lastTs) lastTs = ts;
    }
    const m = o.message;
    if (o.type === 'user' && typeof m?.content === 'string' && firstUserPrompt === undefined) {
      firstUserPrompt = m.content;
    }
    if (o.type === 'assistant' && m && typeof m === 'object') {
      const u = m.usage;
      if (u && typeof u === 'object') {
        tokens += num(u.input_tokens) + num(u.output_tokens) + num(u.cache_creation_input_tokens);
      }
      if (Array.isArray(m.content) && m.content.some((c: any) => c?.type === 'text' && typeof c?.text === 'string' && c.text.trim())) {
        sawAnyText = true;
      }
      const sr = m.stop_reason;
      terminal = typeof sr === 'string' && TERMINAL_REASONS.has(sr);
    }
  }
  if (!startedAt) return null; // arquivo vazio/sem evento válido ainda

  label = labelFromPrompt(firstUserPrompt, agentId);
  const fresh = now - mtimeMs < STALE_MS;
  // Fim = último assistant com stop_reason terminal. Stale-sem-terminal = um run
  // que não escreve mais e nunca fechou (processo morto): trata como falho pra a UI
  // sair do limbo em vez de girar pra sempre.
  let status: BgAgent['status'];
  if (terminal) status = sawAnyText ? 'done' : 'failed';
  else if (fresh) status = 'running';
  else status = 'failed';

  const endTs = lastTs || mtimeMs;
  const durationMs = status === 'running' ? Math.max(0, now - startedAt) : Math.max(0, endTs - startedAt);
  return { id: agentId, label, startedAt, tokens, status, durationMs };
}

// Dir de tasks do CLI: TMPDIR/claude-<uid>/<projectSlug>/<sessionId>/tasks.
export function tasksDir(sessionId: string): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
  return join(tmpdir(), `claude-${uid}`, projectSlug(homedir()), sessionId, 'tasks');
}

function scanSession(sessionId: string, now: number): BgAgent[] {
  const dir = tasksDir(sessionId);
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  const out: BgAgent[] = [];
  for (const name of names) {
    if (!name.endsWith('.output')) continue;
    const id = name.slice(0, -'.output'.length);
    const path = join(dir, name);
    let content: string; let mtimeMs: number;
    try {
      const st = statSync(path);
      mtimeMs = st.mtimeMs;
      content = readFileSync(path, 'utf8');
    } catch { continue; }
    const a = parseAgentFile(id, content, mtimeMs, now);
    if (a) out.push(a);
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
