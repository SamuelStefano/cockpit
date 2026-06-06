import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Session, Message, Block } from './data/mock';
import type { ClientMsg, ServerMsg, SessionMeta, ToolCall, SysStats, PermMode, ModelAlias, EffortLevel, ContextMeta, SkillMeta, UsageStats, TurnStats } from '../shared/protocol';
import { loadPref, savePref } from './lib/persist';
import { requestNotifyPermission, notifyTurnDone, notifyTurnError } from './lib/notify';

export interface ContextDoc { id: string; title: string; body: string }
export interface SkillDoc { id: string; name: string; body: string }
export interface Attachment { name: string; path: string }
import type { ConnState } from './components/primitives';
import type { Phase } from './components/Chat';

// Default: mesma origin (proxy do vite/reverse-proxy resolve o /ws → :7777). Um
// deploy do front separado do back (ex: Vercel servindo a SPA, backend atrás de
// Tailscale serve) seta VITE_WS_URL pra apontar pro host real do backend. Sem
// isso a SPA tenta wss://<host-do-front>/ws e não acha ninguém atendendo.
const ENV_WS = (import.meta.env.VITE_WS_URL ?? '').trim();
const WS_URL = ENV_WS || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

let _mid = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(_mid++).toString(36)}`;

function metaToSession(m: SessionMeta, active: boolean): Session {
  return { id: m.id, title: m.title, relative: m.relative, snippet: m.snippet, mtime: m.mtime, hasTerminal: false, active };
}

function upsertTool(blocks: Block[], tool: ToolCall): Block[] {
  const i = blocks.findIndex((b) => b.type === 'tool' && b.tool.id === tool.id);
  if (i >= 0) {
    const prev = (blocks[i] as { type: 'tool'; tool: ToolCall }).tool;
    // O update de "done"/"error" (tool_result) chega com placeholders genéricos
    // (label/name 'tool', command ''). Preserva os campos reais do "running".
    const merged: ToolCall = {
      ...prev,
      status: tool.status,
      output: tool.output.length ? tool.output : prev.output,
      exit: tool.exit ?? prev.exit,
      expanded: tool.expanded ?? prev.expanded,
      durationMs: tool.durationMs ?? prev.durationMs,
      label: tool.label && tool.label !== 'tool' ? tool.label : prev.label,
      name: tool.name && tool.name !== 'tool' ? tool.name : prev.name,
      command: tool.command || prev.command,
    };
    const next = blocks.slice();
    next[i] = { type: 'tool', tool: merged };
    return next;
  }
  return [...blocks, { type: 'tool', tool }];
}

function appendDelta(blocks: Block[], text: string): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') {
    const next = blocks.slice();
    next[next.length - 1] = { type: 'text', md: last.md + text };
    return next;
  }
  return [...blocks, { type: 'text', md: text }];
}

function appendThinking(blocks: Block[], text: string): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'thinking') {
    const next = blocks.slice();
    next[next.length - 1] = { type: 'thinking', text: last.text + text, expanded: last.expanded };
    return next;
  }
  return [...blocks, { type: 'thinking', text }];
}

export interface TermApi {
  attach: (id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void) => void;
  detach: (id: string) => void;
  input: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
}

export interface Cockpit {
  sessions: Session[];
  loading: boolean;
  activeId: string;
  setActiveId: (id: string) => void;
  messages: Message[];
  phase: Phase;
  running: Set<string>;
  stalled: Set<string>;
  updated: Set<string>;
  draft: string;
  setDraft: (v: string) => void;
  conn: { ws: ConnState; sse: ConnState };
  rate: { resetsAt: number; status: string } | null;
  stats: SysStats | null;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  model: ModelAlias;
  setModel: (m: ModelAlias) => void;
  effort: EffortLevel;
  setEffort: (e: EffortLevel) => void;
  budget: number;
  setBudget: (n: number) => void;
  slashCommands: string[];
  term: TermApi;
  archived: Session[];
  contextTokens: number;
  usage: Record<string, number>;
  lastTurn?: TurnStats;
  lastEnd?: string;
  searchResults: Session[];
  onSearch: (q: string) => void;
  contexts: ContextMeta[];
  openContext: ContextDoc | null;
  onCtxList: () => void;
  onCtxOpen: (id: string) => void;
  onCtxClose: () => void;
  skills: SkillMeta[];
  openSkill: SkillDoc | null;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
  usageStats: UsageStats | null;
  onUsageList: () => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onStop: (sessionKey?: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onClose: (id: string) => void;
  onUnhide: (id: string) => void;
}

export function useCockpit(): Cockpit {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string>('');
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>(() => loadPref('drafts', {} as Record<string, string>));
  const [phases, setPhases] = useState<Record<string, Phase>>({});
  const lastActivity = useRef<Record<string, number>>({}); // sessionKey -> ts do último frame; alimenta o watchdog de "sessão quieta"
  const [clockTick, setClockTick] = useState(0); // re-render periódico p/ recomputar quietas sem novo evento
  const [conn, setConn] = useState<{ ws: ConnState; sse: ConnState }>({ ws: 'reconnecting', sse: 'reconnecting' });
  const [rate, setRate] = useState<{ resetsAt: number; status: string } | null>(null);
  const [stats, setStats] = useState<SysStats | null>(null);
  const [archived, setArchived] = useState<Session[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({}); // sessionKey -> tokens de contexto
  const [turnStats, setTurnStats] = useState<Record<string, TurnStats>>({}); // sessionKey -> custo/duração reais do último turno
  const [interrupted, setInterrupted] = useState<Record<string, string>>({}); // sessionKey -> endReason (budget/max_turns) p/ oferecer "continuar"
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const searchQ = useRef('');
  const [contexts, setContexts] = useState<ContextMeta[]>([]);
  const [openContext, setOpenContext] = useState<ContextDoc | null>(null);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [openSkill, setOpenSkill] = useState<SkillDoc | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);
  const [mode, setMode] = useState<PermMode>(() => loadPref<PermMode>('mode', 'auto'));
  const modeRef = useRef<PermMode>(mode);
  const [model, setModel] = useState<ModelAlias>(() => loadPref<ModelAlias>('model', 'opus'));
  const modelRef = useRef<ModelAlias>(model);
  const [effort, setEffort] = useState<EffortLevel>(() => loadPref<EffortLevel>('effort', 'high'));
  const effortRef = useRef<EffortLevel>(effort);
  const [budget, setBudget] = useState<number>(() => loadPref<number>('budget', 0)); // 0 = sem teto
  const budgetRef = useRef<number>(budget);
  const [slashCommands, setSlashCommands] = useState<string[]>(() => loadPref<string[]>('slashCommands', []));
  // sessionId -> mtime já visto. Sessão cujo mtime no servidor avançou além do
  // visto = "atualizada" (produziu output enquanto você não olhava — run noturno).
  const [seen, setSeen] = useState<Record<string, number>>(() => loadPref<Record<string, number>>('seen', {}));

  const wsRef = useRef<WebSocket | null>(null);
  const runMsg = useRef<Record<string, string>>({});      // sessionKey -> assistant msgId em voo
  const resumeId = useRef<Record<string, string>>({});    // sessionKey -> claude sessionId p/ --resume
  const opened = useRef<Set<string>>(new Set());          // sessionKeys cujo histórico já foi pedido
  const activeRef = useRef('');
  const sessionsRef = useRef<Session[]>([]);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1500); // backoff exponencial, reset no connect bem-sucedido
  const termData = useRef<Map<string, (d: string) => void>>(new Map());   // termId -> xterm.write
  const termReplay = useRef<Map<string, (d: string) => void>>(new Map()); // termId -> reset()+write (snapshot)
  const termExit = useRef<Map<string, () => void>>(new Map());
  const termDims = useRef<Map<string, { cols: number; rows: number }>>(new Map()); // p/ reattach no reconnect

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const threadsRef = useRef<Record<string, Message[]>>(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  const send = useCallback((m: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  }, []);

  const updateThread = useCallback((key: string, fn: (prev: Message[]) => Message[]) => {
    setThreads((prev) => ({ ...prev, [key]: fn(prev[key] || []) }));
  }, []);

  const patchRunMsg = useCallback((key: string, fn: (blocks: Block[]) => Block[]) => {
    const mid = runMsg.current[key];
    if (!mid) return;
    updateThread(key, (prev) => prev.map((m) => (m.id === mid && m.role === 'assistant' ? { ...m, blocks: fn(m.blocks) } : m)));
  }, [updateThread]);

  // Sessão local `new-xxx` ganha um uuid real do claude só no fim do 1º run.
  // Migrar a key local -> uuid evita que ela apareça DUPLICADA no sidebar quando
  // o `list` (reconnect) trouxer a mesma sessão já persistida no JSONL.
  // Migra-se no `done` (não no meio): assim nenhum delta/tool em voo (ainda
  // keyed por `new-xxx`) fica órfão.
  const migrateKey = useCallback((oldKey: string, newId: string) => {
    if (oldKey === newId || !oldKey.startsWith('new-')) return;
    resumeId.current[newId] = newId;
    delete resumeId.current[oldKey];
    opened.current.add(newId);   // history já está local; não re-buscar
    opened.current.delete(oldKey);
    if (activeRef.current === oldKey) { activeRef.current = newId; setActiveIdState(newId); }
    const move = <T,>(prev: Record<string, T>): Record<string, T> => {
      if (!(oldKey in prev)) return prev;
      const next = { ...prev };
      next[newId] = next[oldKey];   // dados locais em voo vencem qualquer entrada já-presente
      delete next[oldKey];
      return next;
    };
    setThreads(move);
    setPhases(move);
    setDrafts(move);
    setUsage(move);
    setTurnStats(move);
    setInterrupted(move);
    // Se o `list` já trouxe newId como linha persistida, renomear oldKey->newId
    // criaria DUAS linhas com o mesmo id. Renomeia a local e remove a duplicata
    // do servidor (a local carrega o estado em voo, então fica preferida).
    setSessions((prev) => {
      const renamed = prev.map((s) => (s.id === oldKey ? { ...s, id: newId } : s));
      const seenIds = new Set<string>();
      return renamed.filter((s) => (seenIds.has(s.id) ? false : (seenIds.add(s.id), true)));
    });
  }, []);

  const onServer = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'sessions': {
        setSessions((prev) => {
          const localOnly = prev.filter((s) => s.id.startsWith('new-'));
          const fromServer = msg.items.map((m) => metaToSession(m, m.id === activeRef.current));
          return [...localOnly, ...fromServer];
        });
        // Baseline: sessão vista pela 1ª vez entra no `seen` com o mtime atual
        // (não vira "atualizada" retroativamente). Só mtime que AVANÇA depois badgeia.
        setSeen((prev) => {
          // baseline ids novos + poda ids que sumiram da lista (arquivados/
          // apagados) pra o mapa não crescer sem limite no localStorage.
          const live = new Set(msg.items.map((m) => m.id));
          const next: Record<string, number> = {};
          let changed = false;
          for (const m of msg.items) {
            next[m.id] = prev[m.id] ?? m.mtime;
            if (prev[m.id] === undefined) changed = true;
          }
          for (const id of Object.keys(prev)) {
            if (id.startsWith('new-')) { next[id] = prev[id]; continue; } // sessão local ainda não migrada
            if (!live.has(id)) changed = true; // podada
          }
          if (changed) savePref('seen', next);
          return changed ? next : prev;
        });
        setLoading(false);
        return;
      }
      case 'history': {
        setThreads((prev) => ({ ...prev, [msg.sessionId]: msg.messages }));
        resumeId.current[msg.sessionId] = msg.sessionId;
        if (msg.tokens) setUsage((u) => ({ ...u, [msg.sessionId]: msg.tokens! }));
        return;
      }
      case 'busy': {
        // Snapshot autoritativo do servidor (envia no connect): quais keys têm
        // run vivo. Reconcilia o phases local — cobre sessões que ESTE cliente
        // não iniciou (run noturno, outra aba) e limpa keys que já terminaram.
        const live = new Set(msg.keys);
        setPhases((p) => {
          const n = { ...p };
          for (const k of msg.keys) if (n[k] !== 'streaming') n[k] = 'thinking';
          for (const k of Object.keys(n)) {
            if (!live.has(k) && (n[k] === 'thinking' || n[k] === 'streaming')) n[k] = 'idle';
          }
          return n;
        });
        return;
      }
      case 'started': {
        lastActivity.current[msg.sessionKey] = Date.now();
        if (runMsg.current[msg.sessionKey]) return; // já em voo (reconnect) — não duplica bubble
        const id = newId('a');
        runMsg.current[msg.sessionKey] = id;
        updateThread(msg.sessionKey, (prev) => [...prev, { id, role: 'assistant', blocks: [], ts: Date.now() }]);
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'thinking' }));
        return;
      }
      case 'replay': {
        // Reconnect mid-run (#10): snapshot autoritativo do turno em voo.
        // Reconstrói (ou sobrescreve) o bubble e segue recebendo deltas ao vivo.
        const key = msg.sessionKey;
        const blocks: Block[] = [];
        if (msg.thinking) blocks.push({ type: 'thinking', text: msg.thinking });
        if (msg.text) blocks.push({ type: 'text', md: msg.text });
        for (const t of msg.tools) blocks.push({ type: 'tool', tool: t });
        let mid = runMsg.current[key];
        if (!mid) { mid = newId('a'); runMsg.current[key] = mid; }
        const id = mid;
        updateThread(key, (prev) =>
          prev.some((m) => m.id === id)
            ? prev.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, blocks } : m))
            : [...prev, { id, role: 'assistant', blocks }],
        );
        setPhases((p) => ({ ...p, [key]: blocks.some((b) => b.type === 'text') ? 'streaming' : 'thinking' }));
        return;
      }
      case 'system': {
        if (msg.sessionId) resumeId.current[msg.sessionKey] = msg.sessionId;
        return;
      }
      case 'slash-commands': {
        setSlashCommands(msg.items);
        savePref('slashCommands', msg.items);
        return;
      }
      case 'delta': {
        lastActivity.current[msg.sessionKey] = Date.now();
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'streaming' }));
        patchRunMsg(msg.sessionKey, (b) => appendDelta(b, msg.text));
        return;
      }
      case 'thinking': {
        lastActivity.current[msg.sessionKey] = Date.now();
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'streaming' }));
        patchRunMsg(msg.sessionKey, (b) => appendThinking(b, msg.text));
        return;
      }
      case 'tool': {
        lastActivity.current[msg.sessionKey] = Date.now();
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'streaming' }));
        patchRunMsg(msg.sessionKey, (b) => upsertTool(b, msg.tool));
        return;
      }
      case 'rate': {
        setRate({ resetsAt: msg.resetsAt, status: msg.status });
        return;
      }
      case 'usage': {
        setUsage((u) => ({ ...u, [msg.sessionKey]: msg.tokens }));
        return;
      }
      case 'stats': {
        setStats(msg.stats);
        return;
      }
      case 'archived': {
        setArchived(msg.items.map((m) => metaToSession(m, false)));
        return;
      }
      case 'search-results': {
        if (msg.q === searchQ.current) setSearchResults(msg.items.map((m) => metaToSession(m, m.id === activeRef.current)));
        return;
      }
      case 'contexts': {
        setContexts(msg.items);
        return;
      }
      case 'context': {
        setOpenContext({ id: msg.id, title: msg.title, body: msg.body });
        return;
      }
      case 'skills': {
        setSkills(msg.items);
        return;
      }
      case 'skill': {
        setOpenSkill({ id: msg.id, name: msg.name, body: msg.body });
        return;
      }
      case 'usage-stats': {
        setUsageStats(msg.stats);
        return;
      }
      case 'uploaded': {
        const next = [...attachmentsRef.current, { name: msg.name, path: msg.path }];
        attachmentsRef.current = next;
        setAttachments(next);
        return;
      }
      case 'term-data': {
        termData.current.get(msg.termId)?.(msg.data);
        return;
      }
      case 'term-replay': {
        termReplay.current.get(msg.termId)?.(msg.data);
        return;
      }
      case 'term-exit': {
        termExit.current.get(msg.termId)?.();
        return;
      }
      case 'done': {
        const key = msg.sessionKey;
        delete runMsg.current[key];
        setPhases((p) => ({ ...p, [key]: 'idle' }));
        if (msg.costUsd !== undefined || msg.durationMs !== undefined) {
          setTurnStats((t) => ({ ...t, [key]: { costUsd: msg.costUsd, durationMs: msg.durationMs, numTurns: msg.numTurns } }));
        }
        const resumable = !!msg.endReason && (msg.endReason.includes('budget') || msg.endReason.includes('max_turns'));
        if (msg.endReason && msg.endReason !== 'success') {
          const note = msg.endReason.includes('budget')
            ? `⚠️ Turno interrompido: teto de gasto atingido${msg.costUsd !== undefined ? ` ($${msg.costUsd.toFixed(3)})` : ''}.`
            : msg.endReason.includes('max_turns')
              ? '⚠️ Turno interrompido: limite de turnos atingido.'
              : `⚠️ Turno encerrado (${msg.endReason}).`;
          updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: note }] }]);
        }
        // Oferece "continuar" só em corte recuperável (budget/max_turns); limpa
        // o flag em qualquer outro encerramento pra não persistir uma oferta velha.
        setInterrupted((p) => {
          if (resumable) return { ...p, [key]: msg.endReason! };
          if (!(key in p)) return p;
          const n = { ...p }; delete n[key]; return n;
        });
        if (msg.sessionId) {
          resumeId.current[key] = msg.sessionId;
          migrateKey(key, msg.sessionId);
        }
        send({ t: 'usage-list' }); // atualiza o burn chip após cada turno
        send({ t: 'list' });       // mtime avança -> badge "atualizada" em sessão não-ativa
        const id = msg.sessionId ?? key;
        notifyTurnDone(
          sessionsRef.current.find((s) => s.id === id || s.id === key)?.title ?? '',
          () => {
            activeRef.current = id;
            setActiveIdState(id);
            setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === id })));
            if (id && !id.startsWith('new-') && !opened.current.has(id)) {
              opened.current.add(id);
              send({ t: 'open', sessionId: id });
            }
          },
        );
        return;
      }
      case 'error': {
        const key = msg.sessionKey ?? activeRef.current; // erro sem key (top-level) não pode travar o spinner
        if (key) {
          delete runMsg.current[key];
          setPhases((p) => ({ ...p, [key]: 'idle' }));
          updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: `⚠️ ${msg.message}` }], error: true }]);
          notifyTurnError(
            sessionsRef.current.find((s) => s.id === key)?.title ?? '',
            msg.message,
            () => {
              activeRef.current = key;
              setActiveIdState(key);
              setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === key })));
            },
          );
        }
        return;
      }
    }
  }, [updateThread, patchRunMsg, migrateKey, send]);

  const connect = useCallback(() => {
    setConn((c) => ({ ...c, ws: 'reconnecting', sse: 'reconnecting' }));
    let ws: WebSocket;
    try { ws = new WebSocket(WS_URL); } catch { scheduleRetry(); return; }
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = 1500; // reconectou — zera o backoff
      setConn({ ws: 'connected', sse: 'connected' });
      send({ t: 'list' });
      send({ t: 'list-archived' });
      send({ t: 'usage-list' });
      for (const [id, d] of termDims.current) send({ t: 'term-open', termId: id, cols: d.cols, rows: d.rows });
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(ev.data)) as ServerMsg; } catch { return; }
      onServer(m);
    };
    ws.onclose = () => { setConn({ ws: 'down', sse: 'down' }); scheduleRetry(); };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, onServer]);

  const scheduleRetry = useCallback(() => {
    if (retry.current) return;
    // Backoff exponencial (1.5s → 30s): no wake-from-sleep com Tailscale flapando,
    // um retry fixo de 1.5s vira tempestade de full-scans (list + archived +
    // usage, cada um varrendo o diretório de sessões e o SQLite síncrono).
    const delay = retryDelay.current;
    retryDelay.current = Math.min(delay * 2, 30_000);
    retry.current = setTimeout(() => { retry.current = null; connect(); }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (retry.current) clearTimeout(retry.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveId = useCallback((id: string) => {
    activeRef.current = id;
    setActiveIdState(id);
    if (attachmentsRef.current.length) { attachmentsRef.current = []; setAttachments([]); }
    setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === id })));
    if (id && !id.startsWith('new-') && !opened.current.has(id)) {
      opened.current.add(id);
      send({ t: 'open', sessionId: id });
    }
  }, [send]);

  const onSend = useCallback((text: string, modeOverride?: PermMode) => {
    const key = activeRef.current;
    if (!key) return;
    requestNotifyPermission(); // 1ª vez: pede permissão (gesto do usuário)
    const atts = attachmentsRef.current;
    // Anexos viram refs de path no início do prompt; o agente abre via Read.
    const wire = atts.length
      ? atts.map((a) => `[anexo: ${a.path}]`).join('\n') + '\n\n' + text
      : text;
    if (atts.length) { attachmentsRef.current = []; setAttachments([]); }
    setInterrupted((p) => { if (!(key in p)) return p; const n = { ...p }; delete n[key]; return n; });
    updateThread(key, (prev) => [...prev, { id: newId('u'), role: 'user', text, ts: Date.now() }]);
    setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: text, relative: 'agora' } : s)));
    setDrafts((d) => ({ ...d, [key]: '' }));
    send({ t: 'send', sessionKey: key, sessionId: resumeId.current[key], text: wire, mode: modeOverride ?? modeRef.current, model: modelRef.current, effort: effortRef.current, maxBudgetUsd: budgetRef.current > 0 ? budgetRef.current : undefined });
  }, [send, updateThread]);

  const onUpload = useCallback((file: File) => {
    const key = activeRef.current;
    if (!key) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const b64 = res.includes(',') ? res.slice(res.indexOf(',') + 1) : res;
      send({ t: 'upload', sessionKey: key, name: file.name, dataB64: b64 });
    };
    reader.readAsDataURL(file);
  }, [send]);

  const onRemoveAttachment = useCallback((path: string) => {
    const next = attachmentsRef.current.filter((a) => a.path !== path);
    attachmentsRef.current = next;
    setAttachments(next);
  }, []);

  const changeMode = useCallback((m: PermMode) => { modeRef.current = m; setMode(m); savePref('mode', m); }, []);
  const changeModel = useCallback((m: ModelAlias) => { modelRef.current = m; setModel(m); savePref('model', m); }, []);
  const changeEffort = useCallback((e: EffortLevel) => { effortRef.current = e; setEffort(e); savePref('effort', e); }, []);
  const changeBudget = useCallback((n: number) => { const v = Number.isFinite(n) && n > 0 ? n : 0; budgetRef.current = v; setBudget(v); savePref('budget', v); }, []);

  // Busca por conteúdo: dispara no backend (grep) e guarda o termo p/ descartar
  // respostas atrasadas. <2 chars limpa os resultados.
  const onSearch = useCallback((q: string) => {
    searchQ.current = q;
    if (q.trim().length < 2) { setSearchResults([]); return; }
    send({ t: 'search', q });
  }, [send]);

  const onCtxList = useCallback(() => send({ t: 'ctx-list' }), [send]);
  const onCtxOpen = useCallback((id: string) => send({ t: 'ctx-open', id }), [send]);
  const onCtxClose = useCallback(() => setOpenContext(null), []);
  const onSkillList = useCallback(() => send({ t: 'skill-list' }), [send]);
  const onSkillOpen = useCallback((id: string) => send({ t: 'skill-open', id }), [send]);
  const onSkillClose = useCallback(() => setOpenSkill(null), []);
  const onUsageList = useCallback(() => send({ t: 'usage-list' }), [send]);

  const term: TermApi = {
    attach: useCallback((id, cols, rows, onData, onExit, onReplay) => {
      termData.current.set(id, onData);
      termExit.current.set(id, onExit);
      termReplay.current.set(id, onReplay);
      termDims.current.set(id, { cols, rows });
      send({ t: 'term-open', termId: id, cols, rows });
    }, [send]),
    detach: useCallback((id) => {
      termData.current.delete(id);
      termExit.current.delete(id);
      termReplay.current.delete(id);
      termDims.current.delete(id);
      send({ t: 'term-detach', termId: id });
    }, [send]),
    input: useCallback((id, data) => send({ t: 'term-input', termId: id, data }), [send]),
    resize: useCallback((id, cols, rows) => {
      const d = termDims.current.get(id);
      if (d) { d.cols = cols; d.rows = rows; }
      send({ t: 'term-resize', termId: id, cols, rows });
    }, [send]),
    kill: useCallback((id) => {
      termData.current.delete(id);
      termExit.current.delete(id);
      termReplay.current.delete(id);
      termDims.current.delete(id);
      send({ t: 'term-close', termId: id });
    }, [send]),
  };

  const onStop = useCallback((sessionKey?: string) => {
    const key = sessionKey ?? activeRef.current;
    if (!key) return;
    send({ t: 'stop', sessionKey: key });
    delete runMsg.current[key];
    setPhases((p) => ({ ...p, [key]: 'idle' }));
  }, [send]);

  const onNew = useCallback(() => {
    const id = newId('new-');
    const s: Session = { id, title: 'Nova sessão', relative: 'agora', snippet: 'Sem mensagens ainda', mtime: Date.now(), hasTerminal: false, active: true };
    setSessions((prev) => [s, ...prev.map((x) => ({ ...x, active: false }))]);
    setThreads((prev) => ({ ...prev, [id]: [] }));
    activeRef.current = id;
    setActiveIdState(id);
  }, []);

  const onRename = useCallback((id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }, []);

  // Fechar = arquivar. Sessão real -> backend esconde do list (não deleta JSONL);
  // sessão local `new-` (sem history) -> só remove da view. Some na hora; se era
  // a ativa, cai pra próxima (abrindo o history dela).
  const onClose = useCallback((id: string) => {
    if (id && !id.startsWith('new-')) send({ t: 'hide', sessionId: id });
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeRef.current !== id) return next;
      const fb = next[0]?.id ?? '';
      activeRef.current = fb;
      setActiveIdState(fb);
      if (fb && !fb.startsWith('new-') && !opened.current.has(fb)) {
        opened.current.add(fb);
        send({ t: 'open', sessionId: fb });
      }
      return next.map((s) => ({ ...s, active: s.id === fb }));
    });
    setThreads((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setPhases((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setDrafts((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setUsage((prev) => { const n = { ...prev }; delete n[id]; return n; });
    delete runMsg.current[id];
    delete resumeId.current[id];
    opened.current.delete(id);
  }, [send]);

  // Desarquivar: backend reenvia sessions + archived; some da lista de arquivadas
  // na hora e reaparece no sidebar principal.
  const onUnhide = useCallback((id: string) => {
    setArchived((prev) => prev.filter((s) => s.id !== id));
    send({ t: 'unhide', sessionId: id });
  }, [send]);

  const messages = threads[activeId] || [];
  const phase = phases[activeId] || 'idle';
  // Sessões com run vivo (pra dot pulsante no sidebar) — útil em run noturno
  // multi-sessão: ver de relance quem ainda trabalha sem abrir cada uma.
  const running = useMemo(
    () => new Set(Object.keys(phases).filter((k) => phases[k] === 'thinking' || phases[k] === 'streaming')),
    [phases]
  );
  // LRU de threads: numa aba aberta por semanas (daily driver), cada sessão
  // visitada deixa o Message[] inteiro em memória pra sempre. Acima do teto,
  // despeja as mais antigas por atividade — nunca a ativa, nem com run vivo, nem
  // locais `new-`. Reabrir re-busca o history do JSONL (tira do `opened`).
  const THREAD_CAP = 30;
  useEffect(() => {
    const keys = Object.keys(threadsRef.current);
    if (keys.length <= THREAD_CAP) return;
    const drop = keys
      .filter((k) => k !== activeRef.current && !running.has(k) && !k.startsWith('new-'))
      .sort((a, b) => (lastActivity.current[a] ?? 0) - (lastActivity.current[b] ?? 0))
      .slice(0, keys.length - THREAD_CAP);
    if (!drop.length) return;
    for (const k of drop) opened.current.delete(k);
    const prune = <T,>(m: Record<string, T>): Record<string, T> => {
      const n = { ...m };
      for (const k of drop) delete n[k];
      return n;
    };
    setThreads(prune);
    setPhases((p) => (drop.some((k) => k in p) ? prune(p) : p));
    setUsage((u) => (drop.some((k) => k in u) ? prune(u) : u));
    for (const k of drop) delete lastActivity.current[k];
  }, [activeId, running]);

  // Watchdog: enquanto algo roda, tica a cada 20s pra recomputar "quietas".
  useEffect(() => {
    if (running.size === 0) return;
    const id = setInterval(() => setClockTick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, [running.size]);
  // Sessão viva mas sem nenhum frame há >2min = "quieta" (tool longo, rate-limit
  // ou travada). Não é alarme — só um sinal de relance pra olhar a madrugada.
  const stalled = useMemo(() => {
    const now = Date.now();
    void clockTick;
    return new Set([...running].filter((k) => now - (lastActivity.current[k] ?? now) > 120_000));
  }, [running, clockTick]);
  // A sessão aberta está sempre "vista": ao abri-la (ou quando seu mtime avança
  // com ela em foco) grava o mtime atual, limpando o badge de atualizada.
  useEffect(() => {
    if (!activeId) return;
    const s = sessions.find((x) => x.id === activeId);
    if (!s) return;
    setSeen((prev) => {
      if (prev[activeId] === s.mtime) return prev;
      const next = { ...prev, [activeId]: s.mtime };
      savePref('seen', next);
      return next;
    });
  }, [activeId, sessions]);
  // Sessão não-ativa cujo mtime avançou além do visto = produziu output novo.
  const updated = useMemo(
    () => new Set(sessions.filter((s) => s.id !== activeId && !running.has(s.id) && seen[s.id] !== undefined && s.mtime > seen[s.id]).map((s) => s.id)),
    [sessions, seen, activeId, running]
  );
  const draft = drafts[activeId] || '';
  const contextTokens = usage[activeId] || 0;
  const lastTurn = turnStats[activeId];
  const lastEnd = interrupted[activeId];
  const setDraft = useCallback((v: string) => setDrafts((d) => ({ ...d, [activeRef.current]: v })), []);

  // Drafts não-enviados sobrevivem a reload. Só persiste sessões reais (uuid) e
  // não-vazias — keys `new-xxx` são efêmeras e não casam após reload.
  useEffect(() => {
    const keep: Record<string, string> = {};
    for (const [k, v] of Object.entries(drafts)) if (v && !k.startsWith('new-')) keep[k] = v;
    savePref('drafts', keep);
  }, [drafts]);

  return { sessions, loading, activeId, setActiveId, messages, phase, running, stalled, updated, draft, setDraft, conn, rate, stats, archived, contextTokens, usage, lastTurn, lastEnd, searchResults, onSearch, contexts, openContext, onCtxList, onCtxOpen, onCtxClose, skills, openSkill, onSkillList, onSkillOpen, onSkillClose, usageStats, onUsageList, attachments, onUpload, onRemoveAttachment, mode, setMode: changeMode, model, setModel: changeModel, effort, setEffort: changeEffort, budget, setBudget: changeBudget, slashCommands, term, onSend, onStop, onNew, onRename, onClose, onUnhide };
}
