import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMsg, ServerMsg, ToolCall } from '../shared/protocol';
import type { ClaudeEvent } from './engine/events';
import { run, sanitize, type RunHandle } from './engine/claude';
import { CONFIG } from './config';
import { listSessions, listArchived } from './sessions/index';
import { searchSessions } from './sessions/search';
import { listContexts, readContext } from './contexts';
import { listSkills, readSkill } from './skills';
import { saveAttachment } from './attachments';
import { recordUsage, usageStats } from './db';
import { hideSession, unhideSession } from './store';
import { parseSession, ctxTokens, diffOf, planOf } from './sessions/parse';
import { collect } from './stats';
import { openTerm, detachTerm, inputTerm, resizeTerm, closeTerm } from './terminals';

interface Thread {
  handle: RunHandle;
  sessionId?: string;
  costUsd?: number;     // custo real do turno (result.total_cost_usd, ground-truth)
  durationMs?: number;
  numTurns?: number;
  endReason?: string;   // result.subtype: success | error_max_budget | error_max_turns | ...
  // Snapshot acumulado p/ replay no reconnect (#10). Os frames vão por broadcast.
  text: string;
  thinking: string;
  tools: ToolCall[];
  toolStart: Map<string, number>; // id -> início, p/ cravar duração no close; morre com o thread
}

const threads = new Map<string, Thread>();

const startedAt = Date.now();
let lastStatsAt = 0;
// Último rate-limit conhecido: o CLI só emite `rate_limit_event` durante um run,
// então uma aba recém-aberta (ou pós-reconnect) ficaria sem o chip de reset até
// o próximo run. Cacheia e replaya no connect — o Samuel quer o reset SEMPRE à vista.
let lastRate: { resetsAt: number; status: string } | null = null;

// Saúde do processo pro /healthz: se o HTTP responde isto, o event loop não está
// totalmente travado. activeRuns/lastStatsAt são informativos (supervisor decide).
export function runStats(): { uptimeMs: number; activeRuns: number; lastStatsAt: number } {
  return { uptimeMs: Date.now() - startedAt, activeRuns: threads.size, lastStatsAt };
}

// Mata toda a árvore de runs vivos. Chamado no shutdown do processo: sem isto,
// um restart (tsx watch, OOM-reap, Ctrl-C) deixa cada `claude -p` detached
// rodando órfão a noite toda — queimando token/CPU sem socket lendo o stdout,
// e o run some pro cliente (threads é só memória). kill() já escala SIGTERM→
// SIGKILL no grupo (detached), então isto encerra a árvore inteira.
export function killAllRuns(): void {
  for (const t of threads.values()) {
    try { t.handle.kill(); } catch { /* já morto */ }
  }
}

// Fan-out: frames de um run vão pra TODOS os clientes abertos, não pra um socket
// fixo. Sem isto, uma 2ª aba (ou um reconnect que cria o socket novo antes do
// 'close' do antigo) rouba o stream e congela a aba anterior no meio do turno.
// O cliente já deduplica por sessionKey/runMsg, então cada aba renderiza uma vez.
let wssRef: WebSocketServer | null = null;

// Backpressure: num socket lento-mas-aberto (celular em wifi ruim, laptop
// dormindo) o buffer do ws cresce sem limite até estourar a heap — o vetor real
// de OOM na madrugada. Frames de alta frequência e reconstruíveis (delta/
// thinking/stats) são pulados PRA ESSE cliente quando o buffer passa do teto; o
// snapshot do thread (capTail) replaya no próximo reconnect. Frames de ciclo de
// vida (started/tool/usage/done/error/...) sempre vão.
const BACKPRESSURE_BYTES = 4 * 1024 * 1024;
const DROPPABLE: ReadonlySet<string> = new Set(['delta', 'thinking', 'stats']);
function broadcast(msg: ServerMsg) {
  if (!wssRef) return;
  const payload = JSON.stringify(msg);
  const droppable = DROPPABLE.has(msg.t);
  for (const c of wssRef.clients) {
    if (c.readyState !== c.OPEN) continue;
    if (droppable && c.bufferedAmount > BACKPRESSURE_BYTES) continue;
    c.send(payload);
  }
}

// Lista de slash-commands aprendida do system/init (global ao CLI+skills, não
// varia por sessão). Cacheada em memória pra popular o palette de comandos.
let slashCommands: string[] = [];

export function attachWs(server: Server) {
  // maxPayload: rejeita frames gigantes no transporte ANTES de o ws alocar/
  // decodificar e o JSON.parse alocar de novo. O upload manda o arquivo inteiro
  // em base64 num frame só; o teto de 15MB do app só checa DEPOIS. 32MB cobre o
  // upload legítimo (15MB → ~20MB em base64) e corta o frame acidental de 100MB.
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 * 1024 });
  wssRef = wss;

  // Heartbeat ping/pong: um socket meio-aberto (laptop dormindo, sem FIN do TCP)
  // não dispara 'close' por horas — e o broadcast segue empurrando frames de
  // ciclo de vida pro buffer de um cliente morto até estourar a heap (o OOM da
  // madrugada). A varredura termina sockets sem pong dentro de um intervalo.
  const beat = setInterval(() => {
    for (const c of wss.clients) {
      const alive = (c as WebSocket & { isAlive?: boolean }).isAlive;
      if (alive === false) { c.terminate(); continue; }
      (c as WebSocket & { isAlive?: boolean }).isAlive = false;
      try { c.ping(); } catch { /* socket já indo embora */ }
    }
  }, 30_000);
  beat.unref();
  wss.on('close', () => clearInterval(beat));

  wss.on('connection', (ws) => {
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });
    send(ws, { t: 'busy', keys: [...threads.keys()] });
    if (slashCommands.length) send(ws, { t: 'slash-commands', items: slashCommands });
    if (lastRate) send(ws, { t: 'rate', ...lastRate });
    // Reconnect mid-run (#10): replaya o snapshot acumulado SÓ pra ESTE socket,
    // pra a UI reconstruir o turno em voo. Os deltas seguintes chegam via
    // broadcast (não roubamos mais o stream das outras abas).
    for (const [key, thread] of threads) {
      send(ws, { t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools });
    }
    collect().then((stats) => send(ws, { t: 'stats', stats })).catch(() => {});

    // terminais anexados por ESTA conexão — pra desanexar no disconnect.
    const myTerms = new Map<string, { onData: (d: string) => void; onExit: () => void }>();

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try { msg = JSON.parse(String(raw)) as ClientMsg; } catch { return; }
      if (handleTerm(ws, msg, myTerms)) return;
      handle(ws, msg).catch((e) => send(ws, { t: 'error', message: sanitize(String(e?.message ?? e)) }));
    });

    ws.on('close', () => {
      for (const [id, h] of myTerms) detachTerm(id, h.onData, h.onExit);
      myTerms.clear();
    });
  });

  startStatsLoop(wss);
  return wss;
}

// Um timer único: amostra a máquina e empurra pra todos os clientes abertos.
// 2s é suave e mantém o delta de CPU significativo.
function startStatsLoop(wss: WebSocketServer) {
  const tick = async () => {
    if (wss.clients.size === 0) return;
    try {
      broadcast({ t: 'stats', stats: await collect() });
      lastStatsAt = Date.now();
    } catch { /* best-effort */ }
  };
  setInterval(tick, 2000).unref();
}

// Terminais (síncrono): true se a msg foi de terminal e já tratada.
function handleTerm(
  ws: WebSocket,
  msg: ClientMsg,
  myTerms: Map<string, { onData: (d: string) => void; onExit: () => void }>,
): boolean {
  switch (msg.t) {
    case 'term-open': {
      if (myTerms.has(msg.termId)) return true; // já anexado nesta conexão
      const onData = (data: string) => send(ws, { t: 'term-data', termId: msg.termId, data });
      const onExit = () => { send(ws, { t: 'term-exit', termId: msg.termId }); myTerms.delete(msg.termId); };
      const onReplay = (data: string) => send(ws, { t: 'term-replay', termId: msg.termId, data });
      const ok = openTerm(msg.termId, msg.cols, msg.rows, onData, onExit, onReplay);
      if (ok) myTerms.set(msg.termId, { onData, onExit });
      else send(ws, { t: 'term-exit', termId: msg.termId });
      return true;
    }
    case 'term-input': { inputTerm(msg.termId, msg.data); return true; }
    case 'term-resize': { resizeTerm(msg.termId, msg.cols, msg.rows); return true; }
    case 'term-detach': {
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      return true; // sessão tmux fica viva pra reattach
    }
    case 'term-close': {
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      closeTerm(msg.termId);
      return true;
    }
  }
  return false;
}

async function handle(ws: WebSocket, msg: ClientMsg) {
  switch (msg.t) {
    case 'list': {
      const items = await listSessions();
      send(ws, { t: 'sessions', items });
      return;
    }
    case 'open': {
      const parsed = await parseSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens });
      return;
    }
    case 'hide': {
      await hideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'unhide': {
      await unhideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'list-archived': {
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'search': {
      send(ws, { t: 'search-results', q: msg.q, items: await searchSessions(msg.q) });
      return;
    }
    case 'ctx-list': {
      send(ws, { t: 'contexts', items: await listContexts() });
      return;
    }
    case 'ctx-open': {
      const c = await readContext(msg.id);
      if (c) send(ws, { t: 'context', id: msg.id, title: c.title, body: c.body });
      return;
    }
    case 'skill-list': {
      send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    case 'skill-open': {
      const s = await readSkill(msg.id);
      if (s) send(ws, { t: 'skill', id: msg.id, name: s.name, body: s.body });
      return;
    }
    case 'usage-list': {
      send(ws, { t: 'usage-stats', stats: usageStats() });
      return;
    }
    case 'upload': {
      const r = await saveAttachment(msg.sessionKey, msg.name, msg.dataB64);
      if ('error' in r) send(ws, { t: 'error', message: r.error });
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path });
      return;
    }
    case 'stop': {
      threads.get(msg.sessionKey)?.handle.kill();
      return;
    }
    case 'send': {
      startRun(ws, msg.sessionKey, msg.text, msg.sessionId, msg.mode, msg.model, msg.effort, msg.maxBudgetUsd);
      return;
    }
  }
}

function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, mode?: string, model?: string, effort?: string, maxBudgetUsd?: number) {
  if (Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) {
    send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' });
    return;
  }
  if (threads.has(sessionKey)) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, sessionId: resumeId, text: '', thinking: '', tools: [], toolStart: new Map() };
  threads.set(sessionKey, thread);
  broadcast({ t: 'started', sessionKey });

  thread.handle = run({
    prompt,
    resumeId,
    mode,
    model,
    effort,
    maxBudgetUsd,
    onEvent: (ev) => translate(sessionKey, thread, ev),
    onError: (message) => broadcast({ t: 'error', sessionKey, message }),
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      broadcast({ t: 'done', sessionKey, sessionId: thread.sessionId ?? '', costUsd: thread.costUsd, durationMs: thread.durationMs, numTurns: thread.numTurns, endReason: thread.endReason });
      threads.delete(sessionKey);
    },
  });
}

// Tradução evento NDJSON -> ServerMsg (squad C2/H1: tool por id de correlação).
function translate(sessionKey: string, thread: Thread, ev: ClaudeEvent) {
  switch (ev.type) {
    case 'rate_limit_event': {
      const info = (ev as any).rate_limit_info;
      if (info) {
        // O CLI manda resetsAt em epoch SEGUNDOS; a UI compara com Date.now() (ms).
        // Normaliza pra ms aqui (guard: valores < 1e12 são claramente segundos).
        const raw = Number(info.resetsAt) || 0;
        const resetsAt = raw > 0 && raw < 1e12 ? raw * 1000 : raw;
        lastRate = { resetsAt, status: info.status };
        broadcast({ t: 'rate', resetsAt, status: info.status });
      }
      capture(thread, ev);
      return;
    }
    case 'system': {
      capture(thread, ev);
      const sc = (ev as any).slash_commands;
      if (Array.isArray(sc) && sc.length && sc.join() !== slashCommands.join()) {
        slashCommands = sc;
        broadcast({ t: 'slash-commands', items: slashCommands });
      }
      if (thread.sessionId) broadcast({ t: 'system', sessionKey, sessionId: thread.sessionId });
      return;
    }
    case 'stream_event': {
      const e = (ev as any).event;
      if (e?.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
        thread.text = capTail(thread.text + e.delta.text);
        broadcast({ t: 'delta', sessionKey, text: e.delta.text });
      } else if (e?.type === 'content_block_delta' && e.delta?.type === 'thinking_delta' && e.delta.thinking) {
        thread.thinking = capTail(thread.thinking + e.delta.thinking);
        broadcast({ t: 'thinking', sessionKey, text: e.delta.thinking });
      } else if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        emitTool(thread, sessionKey, e.content_block, 'running');
      }
      capture(thread, ev);
      return;
    }
    case 'assistant': {
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_use') emitTool(thread, sessionKey, c, 'running');
        }
      }
      const usage = (ev as any).message?.usage;
      const tokens = ctxTokens(usage);
      if (tokens > 0) broadcast({ t: 'usage', sessionKey, tokens });
      recordUsage({
        sessionId: thread.sessionId ?? sessionKey,
        ctxTokens: tokens,
        outputTokens: usage?.output_tokens ?? 0,
        inputTokens: usage?.input_tokens ?? 0,
        cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
        cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
        model: (ev as any).message?.model,
      });
      capture(thread, ev);
      return;
    }
    case 'user': {
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_result') closeTool(thread, sessionKey, c);
        }
      }
      return;
    }
    case 'result': {
      const r = ev as any;
      if (typeof r.total_cost_usd === 'number') thread.costUsd = r.total_cost_usd;
      if (typeof r.duration_ms === 'number') thread.durationMs = r.duration_ms;
      if (typeof r.num_turns === 'number') thread.numTurns = r.num_turns;
      if (typeof r.subtype === 'string') thread.endReason = r.subtype;
      capture(thread, ev);
      return;
    }
  }
}

// O snapshot text/thinking só existe pra replay no reconnect (#10) — a verdade
// completa fica no JSONL. Limita a cauda pra um run de horas com saída enorme
// não inflar a memória do thread nem o payload de replay. Os deltas ao vivo vão
// inteiros pro cliente conectado; só o snapshot é truncado.
const SNAPSHOT_CAP = 512 * 1024;
function capTail(s: string): string {
  return s.length > SNAPSHOT_CAP ? s.slice(s.length - SNAPSHOT_CAP) : s;
}

function capture(thread: Thread, ev: ClaudeEvent) {
  const sid = (ev as any).session_id;
  if (sid && !thread.sessionId) thread.sessionId = sid;
}

// Saída de tool (Read/Bash) pode trazer MBs (dump de arquivo/comando). Sem cap
// ela infla o frame ao vivo, o snapshot retido em thread.tools E o payload de
// replay no reconnect — o vetor real de OOM num run noturno (squad H2). A verdade
// completa fica no JSONL; aqui só a cauda do card precisa caber.
const TOOL_OUTPUT_CAP = 256 * 1024;
function capOutput(lines: string[]): string[] {
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

// Teto de tools retidas por thread: um run de horas com centenas de tools não
// pode crescer sem limite na memória (cada entrada é re-serializada no replay).
const MAX_TOOLS = 300;

// Upsert por id no snapshot do thread (mesma lógica do client upsertTool):
// preserva campos do evento running (diff/command) ao mesclar o done.
function snapshotTool(thread: Thread, tool: ToolCall) {
  const i = thread.tools.findIndex((t) => t.id === tool.id);
  if (i === -1) thread.tools.push(tool);
  else thread.tools[i] = { ...thread.tools[i], ...tool };
  if (thread.tools.length > MAX_TOOLS) {
    // Some o toolStart das tools podadas: uma tool sem tool_result (run morto no
    // meio) nunca passa por closeTool, então sua chave em toolStart só seria
    // limpa aqui. Sem isto, um run de horas com >300 tools vaza timestamps.
    const dropped = thread.tools.splice(0, thread.tools.length - MAX_TOOLS);
    for (const d of dropped) thread.toolStart.delete(d.id);
  }
}

function emitTool(thread: Thread, sessionKey: string, block: any, status: ToolCall['status']) {
  const id = block.id ?? '';
  if (id && !thread.toolStart.has(id)) thread.toolStart.set(id, Date.now());
  const tool: ToolCall = {
    id,
    name: block.name ?? 'tool',
    label: block.name ?? 'tool',
    command: cmdOf(block.input),
    status,
    diff: diffOf(block.name, block.input),
    markdown: planOf(block.name, block.input),
    output: [],
  };
  snapshotTool(thread, tool);
  broadcast({ t: 'tool', sessionKey, tool });
}

function closeTool(thread: Thread, sessionKey: string, c: any) {
  const isErr = !!c.is_error;
  const output = capOutput(Array.isArray(c.content)
    ? c.content.filter((x: any) => x?.type === 'text').map((x: any) => x.text)
    : typeof c.content === 'string' ? c.content.split('\n') : []);
  const id = c.tool_use_id ?? '';
  const start = thread.toolStart.get(id);
  if (start !== undefined) thread.toolStart.delete(id);
  const tool: ToolCall = {
    id,
    name: 'tool',
    label: 'tool',
    command: '',
    status: isErr ? 'error' : 'done',
    exit: isErr ? 1 : 0,
    output,
    expanded: true,
    durationMs: start !== undefined ? Date.now() - start : undefined,
  };
  snapshotTool(thread, tool);
  broadcast({ t: 'tool', sessionKey, tool });
}

function cmdOf(input: unknown): string {
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

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
