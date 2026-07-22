import { createReadStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import type { Block, Message, ToolCall, ToolDiff, ToolQuestion, ToolTodo, TurnBubbleStats } from '../../shared/protocol';
import { CONFIG } from '../config';

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

// Saída de tool pode trazer MBs (dump de arquivo/comando). Sem cap ela infla o
// payload de replay/histórico — vetor real de OOM (squad H2). A verdade completa
// fica no JSONL; aqui só a cauda do card precisa caber. Compartilhado com o
// caminho ao vivo (ws/tools.ts) pra render idêntico.
export const TOOL_OUTPUT_CAP = 256 * 1024;
export function capOutput(lines: string[]): string[] {
  let total = 0;
  const out: string[] = [];
  for (const ln of lines) {
    if (total + ln.length > TOOL_OUTPUT_CAP) {
      const room = TOOL_OUTPUT_CAP - total;
      if (room > 0) out.push(ln.slice(0, room));
      out.push('… (saída truncada — abra a sessão p/ ver tudo)');
      break;
    }
    total += ln.length + 1;
    out.push(ln);
  }
  return out;
}

// Linhas de saída de um bloco tool_result, já capadas. Única extração usada
// tanto no replay (collectToolResults) quanto no ao vivo (ws/tools.ts closeTool)
// pra render idêntico nos dois caminhos.
export function toolResultOutput(c: any): string[] {
  // Paridade: blocos `image` (screenshots de Playwright, saída de tools que
  // retornam imagem) eram filtrados → o card ficava vazio enquanto o terminal
  // mostra a indicação. Emite um placeholder por imagem em vez de descartar.
  return capOutput(Array.isArray(c?.content)
    ? c.content
        .filter((x: any) => x?.type === 'text' || x?.type === 'image')
        .map((x: any) => (x.type === 'image' ? '[imagem]' : String(x.text ?? '')))
    : typeof c?.content === 'string' ? c.content.split('\n') : []);
}

// Os tool_results chegam como records USER (content: [{type:'tool_result',...}])
// no turno seguinte ao tool_use. Sem coletá-los, todo card de tool do histórico
// aparecia "done 0.0s" sem saída nenhuma (bug reportado: terminal mostra o curl,
// app mostra card vazio). Mesma extração do closeTool ao vivo.
export function collectToolResults(r: Rec, map: Map<string, ToolResultRec>): void {
  if (r.type !== 'user' || !Array.isArray(r.message?.content)) return;
  const t = r.timestamp ? Date.parse(r.timestamp) : NaN;
  const ts = Number.isFinite(t) ? t : undefined;
  for (const c of r.message.content as any[]) {
    if (c?.type !== 'tool_result' || typeof c.tool_use_id !== 'string' || !c.tool_use_id) continue;
    map.set(c.tool_use_id, { output: toolResultOutput(c), isErr: !!c.is_error, ts });
  }
}

// Caminho ativo (user/assistant em ordem raiz→folha) a partir do leaf. O leaf vem
// do last-prompt.leafUuid, MAS ele pode apontar pra um uuid que não é record local
// (resume cross-file / folha podada): nesse caso a caminhada nem entra e o
// histórico voltaria VAZIO. Cai pro último user/assistant quando o leaf não existe.
export function activeChain(byUuid: Map<string, Rec>, leaf: string | undefined, lastMsgUuid: string | undefined): Rec[] {
  if (!leaf || !byUuid.has(leaf)) leaf = lastMsgUuid ?? [...byUuid.keys()].pop();
  const chain: Rec[] = [];
  let cur: string | undefined = leaf;
  const guard = new Set<string>();
  while (cur && byUuid.has(cur) && !guard.has(cur)) {
    guard.add(cur);
    const r = byUuid.get(cur)!;
    if (r.type === 'user' || r.type === 'assistant') chain.push(r);
    cur = r.parentUuid ?? undefined;
  }
  chain.reverse();
  return chain;
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

// Um record user com TEXTO (prompt de verdade) abre um turno; users só de
// tool_result são continuação do turno corrente, não fronteira. isMeta e
// compact-summary têm texto e CONTAM como fronteira de propósito: cada um abre
// chamada API própria — somar no turno anterior inflaria o gasto dele.
function isTurnBoundary(r: Rec): boolean {
  if (r.type !== 'user' || !r.message) return false;
  const c = r.message.content;
  if (typeof c === 'string') return !!c.trim();
  if (Array.isArray(c)) return c.some((x: any) => x?.type === 'text' && typeof x?.text === 'string' && x.text.trim());
  return false;
}

// Stats por turno reconstruídas do JSONL — espelho histórico do acumulador ao
// vivo (ws/translate.ts). Sem isto a linha "Xk tokens · Ys" só existia durante
// o run e SUMIA no re-fetch (open/open-full troca o thread inteiro) e nunca
// aparecia pra turnos feitos no terminal. Chave do map = uuid do ÚLTIMO record
// assistant do turno (onde a bolha mostra a linha). Dedupe por message.id: o
// CLI grava um record por content block da MESMA chamada API, repetindo o usage
// — somar todos multiplicaria o gasto. costUsd fica de fora (não existe no
// JSONL; só no result do stream ao vivo).
export function turnStats(recs: Rec[]): Map<string, TurnBubbleStats> {
  const map = new Map<string, TurnBubbleStats>();
  let tokens = 0, inputTokens = 0, outputTokens = 0;
  let lastBilledMsgId: string | undefined;
  let startTs: number | undefined;
  let lastAssistant: Rec | undefined;
  const flush = () => {
    if (lastAssistant?.uuid && tokens > 0) {
      const t = lastAssistant.timestamp ? Date.parse(lastAssistant.timestamp) : NaN;
      const durationMs = startTs !== undefined && Number.isFinite(t) && t >= startTs ? t - startTs : undefined;
      map.set(lastAssistant.uuid, { tokens, inputTokens, outputTokens, durationMs });
    }
    tokens = 0; inputTokens = 0; outputTokens = 0;
    lastBilledMsgId = undefined; lastAssistant = undefined; startTs = undefined;
  };
  for (const r of recs) {
    if (isTurnBoundary(r)) {
      flush();
      const t = r.timestamp ? Date.parse(r.timestamp) : NaN;
      startTs = Number.isFinite(t) ? t : undefined;
    } else if (r.type === 'assistant' && r.message) {
      lastAssistant = r;
      const u = r.message.usage;
      const msgId = r.message.id;
      // Sem message.id não dá pra deduplicar — ignora, espelhando o caminho ao
      // vivo (translate.ts); somar cada record multiplicaria o usage repetido.
      if (u && typeof msgId === 'string' && msgId !== lastBilledMsgId) {
        lastBilledMsgId = msgId;
        // Cache READ fica de fora: é releitura do prefixo (barata e re-cobrada a
        // cada chamada API) — somar inflava um turno comum pra "30M tokens".
        // Conta o trabalho NOVO: input + cache creation + output.
        tokens += num(u.input_tokens) + num(u.output_tokens) + num(u.cache_creation_input_tokens);
        inputTokens += num(u.input_tokens);
        outputTokens += num(u.output_tokens);
      }
    }
  }
  flush();
  return map;
}

// Anota cada bolha assistant que fecha um turno com as stats daquele turno.
// O recToMessage pode ter dropado o último assistant (ex: só tool_use sem
// resultado renderizável) — nesse caso a stat do turno fica sem dono e é
// descartada, igual ao terminal quando o turno aborta.
export function attachTurnStats(messages: Message[], stats: Map<string, TurnBubbleStats>): void {
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const s = stats.get(m.id);
    if (s) m.stats = s;
  }
}

// Resolve o caminho do JSONL com validação anti-traversal (squad High-1).
export function sessionPath(sessionId: string): string | null {
  if (!UUID_RE.test(sessionId)) return null;
  const p = resolve(join(CONFIG.projectsDir, `${sessionId}.jsonl`));
  if (!p.startsWith(resolve(CONFIG.projectsDir))) return null;
  return p;
}

// Cache de parse por (sessionId+mtime+size+limit): durante um turno do TERMINAL,
// session-touched dispara e summarize()+open+list parseiam os MESMOS bytes em
// rajada — re-ler/re-parsear o JSONL inteiro cada vez era o custo de CPU/RAM #13.
// A chave inclui mtime+size, então QUALQUER mudança no arquivo invalida (nunca
// stale). LRU pequeno: amortiza a rajada da mesma versão sem reter histórico.
const PARSE_CACHE = new Map<string, unknown>();
const PARSE_CACHE_MAX = 24;
function parseKey(tag: string, path: string, limit: number): string | null {
  try { const st = statSync(path); return `${tag}:${path}:${st.mtimeMs}:${st.size}:${limit}`; } catch { return null; }
}
function parseCacheGet<T>(key: string | null): T | undefined {
  if (!key) return undefined;
  const v = PARSE_CACHE.get(key);
  if (v !== undefined) { PARSE_CACHE.delete(key); PARSE_CACHE.set(key, v); } // bump LRU
  return v as T | undefined;
}
function parseCacheSet(key: string | null, val: unknown): void {
  if (!key) return;
  PARSE_CACHE.set(key, val);
  if (PARSE_CACHE.size > PARSE_CACHE_MAX) { const k = PARSE_CACHE.keys().next().value; if (k !== undefined) PARSE_CACHE.delete(k); }
}

// Lê o JSONL e reconstrói o CAMINHO ATIVO (não-linear; squad C1):
// 1. último last-prompt.leafUuid = leaf ativo
// 2. indexa uuid -> record (só user/assistant)
// 3. caminha parentUuid leaf->raiz, inverte
export async function parseSession(
  sessionId: string,
  limit = CONFIG.historyLimit
): Promise<{ blocks: Block[]; messages: Message[]; tokens: number; truncated: boolean; todos?: ToolTodo[] } | null> {
  const path = sessionPath(sessionId);
  if (!path) return null;
  const ck = parseKey('S', path, limit);
  const hit = parseCacheGet<{ blocks: Block[]; messages: Message[]; tokens: number; truncated: boolean; todos?: ToolTodo[] }>(ck);
  if (hit) return hit;

  const byUuid = new Map<string, Rec>();
  const results = new Map<string, ToolResultRec>();
  const markers: Message[] = [];
  const seenPr = new Set<string>();
  let leaf: string | undefined;
  let lastMsgUuid: string | undefined;

  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r.type === 'last-prompt' && r.leafUuid) leaf = r.leafUuid;
    collectToolResults(r, results);
    // indexa TODO record com uuid: o parentUuid de user/assistant pode apontar
    // pra um nó intermediário (attachment/system) — se só indexar user/assistant
    // a caminhada quebra no 1º intermediário e trunca o histórico (squad).
    if (r.uuid) byUuid.set(r.uuid, r);
    if (r.uuid && (r.type === 'user' || r.type === 'assistant')) lastMsgUuid = r.uuid;
    const marker = markerFromRec(r, seenPr);
    if (marker) markers.push(marker);
  }

  const chain = activeChain(byUuid, leaf, lastMsgUuid);

  // Último assistant da cadeia ativa carrega o usage mais recente = contexto atual.
  let tokens = 0;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].type === 'assistant' && chain[i].message?.usage) { tokens = ctxTokens(chain[i].message!.usage); break; }
  }

  // O caminho ativo passou do cap → o slice dropou mensagens MAIS ANTIGAS sem
  // marcador. Sinaliza pro front avisar e oferecer o "ver tudo" (parseFullSession),
  // em vez de apresentar um transcript parcial como se fosse completo (squad red-team).
  // Filtra ANTES de cortar: a chain inclui records que viram null (isMeta,
  // tool_results) — contar pelo bruto inflava `truncated` e entregava menos
  // mensagens visíveis que o limit.
  const mapped = chain.map((r) => recToMessage(r, results)).filter((m): m is Message => m !== null);
  attachTurnStats(mapped, turnStats(chain));
  // Registry de tarefas sobre o ARQUIVO inteiro (byUuid preserva a ordem), não
  // só a chain: pós-compact os TaskCreate/TaskUpdate ficam no ramo podado e a
  // chain devolvia zero snapshots — tray vazio em toda sessão compactada.
  const todoMap = taskTodos([...byUuid.values()], results);
  attachTaskTodos(mapped, todoMap);
  // Respostas FORA da cadeia ativa = ramo podado por compactação/edição de
  // mensagem: o transcript linear (parentUuid leaf→raiz) as esconde, então o
  // usuário reabre a sessão e "some" o que viu ao vivo. Sinaliza truncated pra o
  // front oferecer "ver tudo" (parseFullSession costura o arquivo inteiro). Conta
  // só assistant-com-message (respostas reais), não meta/tool_result, pra sessão
  // linear normal não disparar falso-positivo.
  const chainUuids = new Set<string>();
  for (const r of chain) if (r.uuid) chainUuids.add(r.uuid);
  let offChainAssistant = 0;
  for (const r of byUuid.values()) {
    if (r.type === 'assistant' && r.uuid && r.message && !chainUuids.has(r.uuid)) offChainAssistant++;
  }
  const all = weaveByTs(truncateAtPendingQuestion(mapped), markers);
  const truncated = all.length > limit || offChainAssistant > 0;
  const messages = all.slice(-limit);
  const blocks = messages.flatMap((m) =>
    m.role === 'assistant' ? m.blocks : m.role === 'user' ? [{ type: 'text' as const, md: m.text }] : [],
  );
  const out = { blocks, messages, tokens, truncated, todos: finalTodos(todoMap) };
  parseCacheSet(ck, out);
  return out;
}

// Histórico COMPLETO em ordem de arquivo (não só o caminho ativo). Após /compact
// o CLI ramifica de um summary e as mensagens antigas saem do caminho parentUuid —
// some do parseSession. Esta variante devolve TODOS os user/assistant na ordem em
// que foram gravados, pro viewer "ver tudo (inclui pré-compactação)". Capado no fim.
export async function parseFullSession(
  sessionId: string,
  limit = CONFIG.historyLimit,
): Promise<{ messages: Message[]; tokens: number; truncated: boolean; todos?: ToolTodo[] } | null> {
  const path = sessionPath(sessionId);
  if (!path) return null;
  const ck = parseKey('F', path, limit);
  const hit = parseCacheGet<{ messages: Message[]; tokens: number; truncated: boolean; todos?: ToolTodo[] }>(ck);
  if (hit) return hit;

  const recs: Rec[] = [];
  const results = new Map<string, ToolResultRec>();
  const markers: Message[] = [];
  const seenPr = new Set<string>();
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    collectToolResults(r, results);
    if (r.uuid && (r.type === 'user' || r.type === 'assistant')) recs.push(r);
    const marker = markerFromRec(r, seenPr);
    if (marker) markers.push(marker);
  }

  let tokens = 0;
  for (let i = recs.length - 1; i >= 0; i--) {
    if (recs[i].type === 'assistant' && recs[i].message?.usage) { tokens = ctxTokens(recs[i].message!.usage); break; }
  }

  const mapped = recs.map((r) => recToMessage(r, results)).filter((m): m is Message => m !== null);
  attachTurnStats(mapped, turnStats(recs));
  const todoMap = taskTodos(recs, results);
  attachTaskTodos(mapped, todoMap);
  const all = weaveByTs(mapped, markers);
  const out = { messages: all.slice(-limit), tokens, truncated: all.length > limit, todos: finalTodos(todoMap) };
  parseCacheSet(ck, out);
  return out;
}

// Slash command e saída de !comando chegam como user text com as tags XML do
// harness — o terminal mostra "/model x" e a saída limpa; o app mostrava o XML
// cru com códigos ANSI. null = nada renderizável (paridade: o terminal omite).
export function cleanUserText(text: string): string | null {
  // Notificação de subagente de background (XML do harness): o terminal a esconde;
  // como bolha atribuía ao Samuel um texto que ele nunca mandou e virava spam
  // quando um agente zumbi re-notificava. Omite igual ao terminal.
  if (text.includes('<task-notification>')) return null;
  if (text.includes('<command-name>')) {
    const name = /<command-name>([^<]*)<\/command-name>/.exec(text)?.[1]?.trim() ?? '';
    const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1]?.trim() ?? '';
    const out = `${name}${args ? ' ' + args : ''}`.trim();
    return out || null;
  }
  if (text.includes('<local-command-stdout>')) {
    const m = /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/.exec(text);
    const out = (m?.[1] ?? '').replace(/\u001b\[[0-9;]*m/g, '').trim();
    return out || null;
  }
  return text;
}

// Registros que o terminal mostra e o app perdia: pr-link (sem uuid — dedup por
// URL, fica a 1ª ocorrência) e o wakeup de loop agendado. Viram divisores finos
// tecidos na timeline por timestamp (weaveByTs).
export function markerFromRec(r: Rec, seenPr: Set<string>): Message | null {
  const o = r as unknown as Record<string, unknown>;
  const t = r.timestamp ? Date.parse(r.timestamp) : NaN;
  const ts = Number.isFinite(t) ? t : undefined;
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

export function weaveByTs(messages: Message[], extras: Message[]): Message[] {
  if (!extras.length) return messages;
  const out = [...messages];
  for (const e of [...extras].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))) {
    let i = out.length;
    for (let j = 0; j < out.length; j++) {
      if ((out[j].ts ?? Infinity) > (e.ts ?? 0)) { i = j; break; }
    }
    out.splice(i, 0, e);
  }
  return out;
}

export function recToMessage(r: Rec, results?: Map<string, ToolResultRec>): Message | null {
  if (!r.message) return null;
  const content = r.message.content;
  const t = r.timestamp ? Date.parse(r.timestamp) : NaN;
  const ts = Number.isFinite(t) ? t : undefined;
  // O CLI grava o sumário de auto-compactação como um user com isCompactSummary:
  // vira divisor inline (DR-012), não a bolha gigante de "This session is being continued…".
  if (r.isCompactSummary) {
    return { id: r.uuid ?? `compact-${ts ?? 0}`, role: 'compact', trigger: 'auto', ts };
  }
  // Prompts sintéticos do harness (loop wakeup, hooks) vêm como user com isMeta —
  // o terminal os esconde ("✻ Claude resuming /loop wakeup"). Renderizar como
  // bolha atribuiria ao Samuel texto que ele nunca mandou (bug reportado).
  if (r.isMeta && r.message.role === 'user') return null;
  if (r.message.role === 'user') {
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('\n')
        : '';
    const cleaned = text.trim() ? cleanUserText(text) : null;
    if (!cleaned) return null;
    return { id: r.uuid!, role: 'user', text: cleaned, ts };
  }
  if (r.message.role === 'assistant' && Array.isArray(content)) {
    // Artefato do --resume pós-AskUserQuestion: o CLI injeta um assistant
    // "No response requested." SEM isMeta — renderizava como bolha real do
    // Claude logo depois da resposta do usuário (a "bolha fantasma").
    if (content.length === 1 && (content[0] as any)?.type === 'text' && (content[0] as any).text === 'No response requested.') return null;
    const blocks: Block[] = [];
    for (const c of content as any[]) {
      if (c?.type === 'text' && c.text) blocks.push({ type: 'text', md: c.text });
      else if (c?.type === 'thinking' && c.thinking) blocks.push({ type: 'thinking', text: c.thinking });
      else if (c?.type === 'tool_use') {
        const res = c.id ? results?.get(c.id) : undefined;
        const durationMs = res?.ts !== undefined && ts !== undefined && res.ts >= ts ? res.ts - ts : undefined;
        const tool: ToolCall = {
          id: c.id ?? '',
          name: c.name ?? 'tool',
          label: labelOf(c.name, c.input),
          command: commandOf(c.name, c.input),
          status: res?.isErr ? 'error' : 'done',
          exit: res ? (res.isErr ? 1 : 0) : undefined,
          durationMs,
          diff: diffOf(c.name, c.input),
          markdown: planOf(c.name, c.input),
          questions: questionsOf(c.name, c.input),
          todos: todosOf(c.name, c.input),
          output: res?.output ?? [],
        };
        blocks.push({ type: 'tool', tool });
      }
    }
    if (!blocks.length) return null;
    return { id: r.uuid!, role: 'assistant', blocks, ts, model: r.message.model };
  }
  return null;
}

// Subagent (Agent no app, Task no Claude Code stock) carrega o tipo no input —
// sobe pro rótulo do card ("Agent · Explore"), como o terminal mostra. Sem isto
// o card dizia só "Agent" e o usuário não sabia QUAL agente rodou.
export function labelOf(name: unknown, input: unknown): string {
  const n = typeof name === 'string' && name ? name : 'tool';
  if ((n === 'Agent' || n === 'Task') && input && typeof input === 'object') {
    const t = (input as Record<string, unknown>).subagent_type;
    if (typeof t === 'string' && t) return `${n} · ${t}`;
  }
  return n;
}

// Linha de argumento por ferramenta. TaskCreate/TaskUpdate não têm nenhuma das
// chaves genéricas (subject/taskId ficavam de fora) — o card aparecia vazio,
// enquanto o terminal mostra o título da task. Demais tools seguem o fallback.
export function commandOf(name: unknown, input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (name === 'TaskCreate' && typeof o.subject === 'string' && o.subject) return o.subject;
    if (name === 'TaskUpdate' && (typeof o.taskId === 'string' || typeof o.taskId === 'number')) {
      const parts = [`#${o.taskId}`];
      if (typeof o.status === 'string' && o.status) parts.push(`→ ${o.status}`);
      if (typeof o.subject === 'string' && o.subject) parts.push(`· ${o.subject}`);
      return parts.join(' ');
    }
  }
  return extractCommand(input);
}

export function extractCommand(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    // Ordem: Bash(command) → file-tools(file_path) → Grep/Glob(pattern) →
    // WebFetch(url) → WebSearch(query) → Task(description). Sem isto, esses
    // cards apareciam sem nenhuma linha de argumento.
    for (const key of ['command', 'file_path', 'pattern', 'url', 'query', 'description'] as const) {
      if (typeof o[key] === 'string' && o[key]) return o[key] as string;
    }
  }
  return '';
}

// Edit/Write carregam o conteúdo antes/depois no input — extrai pra render de
// diff colorido. Edit: old_string/new_string. Write: content (old vazio).
export function diffOf(name: unknown, input: unknown): ToolDiff | undefined {
  if (typeof name !== 'string' || !input || typeof input !== 'object') return undefined;
  const o = input as Record<string, unknown>;
  const path = typeof o.file_path === 'string' ? o.file_path : '';
  if (!path) return undefined;
  if (name === 'Edit' && typeof o.old_string === 'string' && typeof o.new_string === 'string') {
    return { path, old: o.old_string, new: o.new_string };
  }
  if (name === 'Write' && typeof o.content === 'string') {
    return { path, old: '', new: o.content };
  }
  // MultiEdit aplica vários old/new no mesmo arquivo; junta os hunks num par só
  // pro DiffView (sem isto, MultiEdit — muito usado — não mostrava diff nenhum).
  if (name === 'MultiEdit' && Array.isArray(o.edits)) {
    const edits = (o.edits as Array<Record<string, unknown>>).filter(
      (e) => e && typeof e.old_string === 'string' && typeof e.new_string === 'string',
    );
    if (edits.length) {
      return {
        path,
        old: edits.map((e) => e.old_string as string).join('\n'),
        new: edits.map((e) => e.new_string as string).join('\n'),
      };
    }
  }
  return undefined;
}

// ExitPlanMode carrega o plano (markdown) no input.plan — extrai pra render rico
// no card da ferramenta (o plano fica invisível sem isso; squad plan-mode).
export function planOf(name: unknown, input: unknown): string | undefined {
  if (name !== 'ExitPlanMode' || !input || typeof input !== 'object') return undefined;
  const plan = (input as Record<string, unknown>).plan;
  return typeof plan === 'string' && plan.trim() ? plan : undefined;
}

// AskUserQuestion carrega input.questions[] (cada uma: question/header/multiSelect/
// options[{label,description}]). O `claude -p` é single-shot com stdin ignorado, então
// a resposta não pode voltar no mesmo turno — extraímos as perguntas pra render de
// botões clicáveis e a escolha vira o PRÓXIMO prompt (resume continua). Sem isto, o
// card aparecia vazio e o usuário ficava travado num turno que espera input que nunca chega.
// O conteúdo do assistant traz uma AskUserQuestion pronta (com perguntas válidas)?
// O turno precisa ENCERRAR aqui: o `claude -p` ficaria pendurado esperando um
// tool_result que nunca chega (stdin ignorado), e o card de escolha só destrava
// quando a fase volta a idle. Detecta pra o engine matar o run e a escolha virar
// o próximo prompt via --resume.
export function contentHasQuestion(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((c: any) => c?.type === 'tool_use' && !!questionsOf(c?.name, c?.input)?.length);
}

export function questionsOf(name: unknown, input: unknown): ToolQuestion[] | undefined {
  if (name !== 'AskUserQuestion' || !input || typeof input !== 'object') return undefined;
  const raw = (input as Record<string, unknown>).questions;
  if (!Array.isArray(raw)) return undefined;
  const questions: ToolQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue;
    const o = q as Record<string, unknown>;
    const question = typeof o.question === 'string' ? o.question : '';
    const header = typeof o.header === 'string' ? o.header : '';
    if (!question) continue;
    const opts = Array.isArray(o.options) ? o.options : [];
    const options = opts
      .filter((op): op is Record<string, unknown> => !!op && typeof op === 'object' && typeof (op as Record<string, unknown>).label === 'string')
      .map((op) => ({
        label: op.label as string,
        description: typeof op.description === 'string' ? op.description : undefined,
      }));
    if (!options.length) continue;
    questions.push({ question, header, multiSelect: o.multiSelect === true, options });
  }
  return questions.length ? questions : undefined;
}

// TodoWrite carrega input.todos[] (cada uma: content/status/activeForm). Extrai pra
// render do painel de tarefas no card (sem isto, TodoWrite virava card genérico sem
// a lista de itens). Status fora do enum vira 'pending' (JSONL não-confiável).
export function todosOf(name: unknown, input: unknown): ToolTodo[] | undefined {
  if (name !== 'TodoWrite' || !input || typeof input !== 'object') return undefined;
  const raw = (input as Record<string, unknown>).todos;
  if (!Array.isArray(raw)) return undefined;
  const todos: ToolTodo[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const content = typeof o.content === 'string' ? o.content : '';
    if (!content) continue;
    const status = o.status === 'in_progress' || o.status === 'completed' ? o.status : 'pending';
    const activeForm = typeof o.activeForm === 'string' && o.activeForm ? o.activeForm : undefined;
    todos.push({ content, status, activeForm });
  }
  return todos.length ? todos : undefined;
}

// O harness atual usa TaskCreate/TaskUpdate (não TodoWrite — zero ocorrências nos
// JSONLs reais) e a lista é ESTADO acumulado entre chamadas, não payload de uma
// chamada só. Reconstrói um registry (id → item) e tira snapshot a cada mutação,
// pro card mostrar a lista corrente como o terminal mostra.
export type TaskRegistry = Map<string, ToolTodo>;

const TASK_STATUSES: readonly string[] = ['pending', 'in_progress', 'completed'];

// TaskCreate só ganha id no tool_result ("Task #228 created successfully: …"):
// o input traz subject/activeForm, o result traz o número. Sem result (run morto
// no meio) ou com erro, a task não nasceu.
export function registerTaskCreate(tasks: TaskRegistry, input: unknown, res?: { output: string[]; isErr: boolean }): boolean {
  if (!res || res.isErr || !input || typeof input !== 'object') return false;
  const o = input as Record<string, unknown>;
  const content = typeof o.subject === 'string' && o.subject ? o.subject : '';
  if (!content) return false;
  const m = /Task\s*#\s*(\d+)/i.exec(res.output.join('\n'));
  if (!m) return false;
  const activeForm = typeof o.activeForm === 'string' && o.activeForm ? o.activeForm : undefined;
  tasks.set(m[1], { content, status: 'pending', activeForm });
  return true;
}

export function applyTaskUpdate(tasks: TaskRegistry, input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const o = input as Record<string, unknown>;
  const id = typeof o.taskId === 'string' || typeof o.taskId === 'number' ? String(o.taskId) : '';
  if (!id) return false;
  if (o.status === 'deleted') return tasks.delete(id);
  const prev = tasks.get(id);
  // Update de task criada fora da janela/sessão (a lista do harness é global):
  // entra como placeholder numerado — melhor que engolir a mudança de status.
  const content = typeof o.subject === 'string' && o.subject ? o.subject : prev?.content ?? `Tarefa #${id}`;
  const status = typeof o.status === 'string' && TASK_STATUSES.includes(o.status) ? (o.status as ToolTodo['status']) : prev?.status ?? 'pending';
  const activeForm = typeof o.activeForm === 'string' && o.activeForm ? o.activeForm : prev?.activeForm;
  tasks.set(id, { content, status, activeForm });
  return true;
}

export function taskSnapshot(tasks: TaskRegistry): ToolTodo[] | undefined {
  return tasks.size ? [...tasks.values()].map((t) => ({ ...t })) : undefined;
}

// Snapshot da lista por tool_use de TaskCreate/TaskUpdate — chave = id do tool_use,
// casando com ToolCall.id do recToMessage pro attach.
export function taskTodos(recs: Rec[], results: Map<string, ToolResultRec>): Map<string, ToolTodo[]> {
  const tasks: TaskRegistry = new Map();
  const out = new Map<string, ToolTodo[]>();
  for (const r of recs) {
    if (r.type !== 'assistant' || !r.message || !Array.isArray(r.message.content)) continue;
    for (const c of r.message.content as any[]) {
      if (c?.type !== 'tool_use' || typeof c.id !== 'string' || !c.id) continue;
      const changed = c.name === 'TaskCreate'
        ? registerTaskCreate(tasks, c.input, results.get(c.id))
        : c.name === 'TaskUpdate' ? applyTaskUpdate(tasks, c.input) : false;
      if (!changed) continue;
      const snap = taskSnapshot(tasks);
      if (snap) out.set(c.id, snap);
    }
  }
  return out;
}

// Snapshot FINAL do registry de tarefas do arquivo inteiro. A chain ativa
// pós-compact perde os TaskCreate/TaskUpdate antigos (ramo podado) — o tray
// precisa do estado corrente da sessão, não só do que está visível.
export function finalTodos(map: Map<string, ToolTodo[]>): ToolTodo[] | undefined {
  let last: ToolTodo[] | undefined;
  for (const v of map.values()) last = v;
  return last;
}

export function attachTaskTodos(messages: Message[], map: Map<string, ToolTodo[]>): void {
  if (!map.size) return;
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    for (const b of m.blocks) {
      if (b.type !== 'tool' || b.tool.todos) continue;
      const snap = map.get(b.tool.id);
      if (snap) b.tool.todos = snap;
    }
  }
}

// AskUserQuestion sem resposta real depois: no `claude -p` a pergunta é
// auto-resolvida e o turno CONTINUA (continuação baseada numa resposta falsa). No
// reload isso enterrava a pergunta e o card não ficava respondível. Se uma pergunta
// é o último assistant SEM nenhum prompt de usuário depois dela, corta a continuação
// — a pergunta volta a ser a última mensagem (respondível), espelhando o ao vivo.
function hasQuestionBlock(m: Message): boolean {
  return m.role === 'assistant' && m.blocks.some((b) => b.type === 'tool' && b.tool.name === 'AskUserQuestion' && (b.tool.questions?.length ?? 0) > 0);
}
export function truncateAtPendingQuestion(messages: Message[]): Message[] {
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  for (let i = messages.length - 1; i > lastUser; i--) {
    if (hasQuestionBlock(messages[i])) return messages.slice(0, i + 1);
  }
  return messages;
}
