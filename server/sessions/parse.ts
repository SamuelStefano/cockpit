import { statSync } from 'node:fs';
import type { Block, Message, ToolCall, ToolTodo, TurnBubbleStats } from '../../shared/protocol';
import { CONFIG } from '../config';
import {
  activeChain, lastCtxTokens, num, readRecords, recTs, sessionPath,
  type Rec, type ToolResultRec,
} from './records';
import { attachTaskTodos, finalTodos, taskTodos } from './tasks';
import { commandOf, diffOf, labelOf, planOf, questionsOf, todosOf } from './tool-views';

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
      const t = recTs(lastAssistant);
      const durationMs = startTs !== undefined && t !== undefined && t >= startTs ? t - startTs : undefined;
      map.set(lastAssistant.uuid, { tokens, inputTokens, outputTokens, durationMs });
    }
    tokens = 0; inputTokens = 0; outputTokens = 0;
    lastBilledMsgId = undefined; lastAssistant = undefined; startTs = undefined;
  };
  for (const r of recs) {
    if (isTurnBoundary(r)) {
      flush();
      startTs = recTs(r);
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

  const { byUuid, results, markers, leaf, lastMsgUuid } = await readRecords(path);
  const chain = activeChain(byUuid, leaf, lastMsgUuid);
  const tokens = lastCtxTokens(chain);

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
  const visible = truncateAtPendingQuestion(mapped);
  const inRange = markersInRange(visible, markers);
  const all = weaveByTs(visible, inRange);
  const truncated = all.length > limit || offChainAssistant > 0 || inRange.length < markers.length;
  const messages = all.slice(-limit);
  const blocks = messages.flatMap((m) =>
    m.role === 'assistant' ? m.blocks : m.role === 'user' ? [{ type: 'text' as const, md: m.text }] : [],
  );
  const out = { blocks, messages, tokens, truncated, todos: finalTodos(todoMap) };
  parseCacheSet(ck, out);
  return out;
}

type Timeline = { all: Message[]; tokens: number; todos?: ToolTodo[] };

// Slot ÚNICO, fora do LRU de parse: a timeline sem cap de uma sessão de daily
// driver passa de 25k mensagens (~48MB serializados) e 24 dessas no LRU derrubariam
// a VPS. Uma só basta — a paginação acontece numa sessão de cada vez.
let timelineCache: { key: string; val: Timeline } | null = null;

// Timeline COMPLETA do arquivo, sem cap. Cacheada com chave sem limit pra a
// paginação fatiar páginas sucessivas de graça: reler 90k linhas de JSONL a cada
// "carregar mais antigas" custaria segundos.
async function fullTimeline(sessionId: string): Promise<Timeline | null> {
  const path = sessionPath(sessionId);
  if (!path) return null;
  const ck = parseKey('F', path, 0);
  if (ck && timelineCache?.key === ck) return timelineCache.val;

  const { msgs, results, markers } = await readRecords(path);
  const mapped = msgs.map((r) => recToMessage(r, results)).filter((m): m is Message => m !== null);
  attachTurnStats(mapped, turnStats(msgs));
  const todoMap = taskTodos(msgs, results);
  attachTaskTodos(mapped, todoMap);
  const out: Timeline = { all: weaveByTs(mapped, markers), tokens: lastCtxTokens(msgs), todos: finalTodos(todoMap) };
  if (ck) timelineCache = { key: ck, val: out };
  return out;
}

// Uma PÁGINA do histórico completo (não só o caminho ativo). Após /compact o CLI
// ramifica de um summary e as mensagens antigas saem do caminho parentUuid — somem
// do parseSession. Sem `before` devolve a última página; com `before` (id da mensagem
// mais antiga que o cliente já tem) devolve a página imediatamente anterior, pra o
// cliente prepender. Assim a página tem tamanho FIXO por mais fundo que se vá:
// mandar a timeline inteira de uma sessão de daily driver seria um frame de ~48MB.
export async function parseFullSession(
  sessionId: string,
  before?: string,
  limit = CONFIG.historyLimit,
): Promise<{ messages: Message[]; tokens: number; truncated: boolean; todos?: ToolTodo[] } | null> {
  const t = await fullTimeline(sessionId);
  if (!t) return null;
  const at = before ? t.all.findIndex((m) => m.id === before) : -1;
  const stop = at >= 0 ? at : t.all.length;
  const start = Math.max(0, stop - Math.max(1, limit));
  return { messages: t.all.slice(start, stop), tokens: t.tokens, truncated: start > 0, todos: t.todos };
}

// Slash command e saída de !comando chegam como user text com as tags XML do
// harness — o terminal mostra "/model x" e a saída limpa; o app mostrava o XML
// cru com códigos ANSI. null = nada renderizável (paridade: o terminal omite).
export function cleanUserText(text: string): string | null {
  // Notificação de subagente de background (XML do harness): o terminal a esconde;
  // como bolha atribuía ao Samuel um texto que ele nunca mandou e virava spam
  // quando um agente zumbi re-notificava. Ancorado no início pra não engolir uma
  // mensagem de verdade que só cite a tag.
  if (/^\s*<task-notification>/.test(text)) return null;
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

// Os marcadores são varridos do ARQUIVO inteiro, mas a thread mostra só a cadeia
// ativa. Pós-compactação sobravam centenas de PRs de dias atrás sem nenhuma
// mensagem em volta — uma sessão real abria com 371 divisores para 36 mensagens,
// e rolar pro prompt anterior virava impossível. Link fora do intervalo visível
// não tem contexto; ele continua na thread completa ("ver tudo"). Marcador sem ts
// também cai fora: weaveByTs o ancora em `?? 0`, ou seja, empilhado no topo da
// thread — exatamente a parede que isso resolve.
export function markersInRange(messages: Message[], markers: Message[]): Message[] {
  const first = messages.find((m) => m.ts !== undefined)?.ts;
  if (first === undefined) return markers;
  return markers.filter((m) => m.ts !== undefined && m.ts >= first);
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
  const ts = recTs(r);
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
