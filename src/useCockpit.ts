import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session, Message, Block } from './data/mock';
import type { ClientMsg, ServerMsg, SessionMeta, ToolCall, SysStats, PermMode, ContextMeta, SkillMeta } from '../shared/protocol';

export interface ContextDoc { id: string; title: string; body: string }
export interface SkillDoc { id: string; name: string; body: string }
export interface Attachment { name: string; path: string }
import type { ConnState } from './components/primitives';
import type { Phase } from './components/Chat';

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

let _mid = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(_mid++).toString(36)}`;

function metaToSession(m: SessionMeta, active: boolean): Session {
  return { id: m.id, title: m.title, relative: m.relative, snippet: m.snippet, hasTerminal: false, active };
}

function upsertTool(blocks: Block[], tool: ToolCall): Block[] {
  const i = blocks.findIndex((b) => b.type === 'tool' && b.tool.id === tool.id);
  if (i >= 0) {
    const next = blocks.slice();
    next[i] = { type: 'tool', tool };
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
  draft: string;
  setDraft: (v: string) => void;
  conn: { ws: ConnState; sse: ConnState };
  rate: { resetsAt: number; status: string } | null;
  stats: SysStats | null;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  term: TermApi;
  archived: Session[];
  contextTokens: number;
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
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
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
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [phases, setPhases] = useState<Record<string, Phase>>({});
  const [conn, setConn] = useState<{ ws: ConnState; sse: ConnState }>({ ws: 'reconnecting', sse: 'reconnecting' });
  const [rate, setRate] = useState<{ resetsAt: number; status: string } | null>(null);
  const [stats, setStats] = useState<SysStats | null>(null);
  const [archived, setArchived] = useState<Session[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({}); // sessionKey -> tokens de contexto
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const searchQ = useRef('');
  const [contexts, setContexts] = useState<ContextMeta[]>([]);
  const [openContext, setOpenContext] = useState<ContextDoc | null>(null);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [openSkill, setOpenSkill] = useState<SkillDoc | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);
  const [mode, setMode] = useState<PermMode>('auto');
  const modeRef = useRef<PermMode>('auto');

  const wsRef = useRef<WebSocket | null>(null);
  const runMsg = useRef<Record<string, string>>({});      // sessionKey -> assistant msgId em voo
  const resumeId = useRef<Record<string, string>>({});    // sessionKey -> claude sessionId p/ --resume
  const opened = useRef<Set<string>>(new Set());          // sessionKeys cujo histórico já foi pedido
  const activeRef = useRef('');
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termData = useRef<Map<string, (d: string) => void>>(new Map());   // termId -> xterm.write
  const termReplay = useRef<Map<string, (d: string) => void>>(new Map()); // termId -> reset()+write (snapshot)
  const termExit = useRef<Map<string, () => void>>(new Map());
  const termDims = useRef<Map<string, { cols: number; rows: number }>>(new Map()); // p/ reattach no reconnect

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
      next[newId] = next[oldKey];
      delete next[oldKey];
      return next;
    };
    setThreads(move);
    setPhases(move);
    setDrafts(move);
    setUsage(move);
    setSessions((prev) => prev.map((s) => (s.id === oldKey ? { ...s, id: newId } : s)));
  }, []);

  const onServer = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'sessions': {
        setSessions((prev) => {
          const localOnly = prev.filter((s) => s.id.startsWith('new-'));
          const fromServer = msg.items.map((m) => metaToSession(m, m.id === activeRef.current));
          return [...localOnly, ...fromServer];
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
      case 'busy': return;
      case 'started': {
        if (runMsg.current[msg.sessionKey]) return; // já em voo (reconnect) — não duplica bubble
        const id = newId('a');
        runMsg.current[msg.sessionKey] = id;
        updateThread(msg.sessionKey, (prev) => [...prev, { id, role: 'assistant', blocks: [] }]);
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'thinking' }));
        return;
      }
      case 'system': {
        if (msg.sessionId) resumeId.current[msg.sessionKey] = msg.sessionId;
        return;
      }
      case 'delta': {
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'streaming' }));
        patchRunMsg(msg.sessionKey, (b) => appendDelta(b, msg.text));
        return;
      }
      case 'tool': {
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
        if (msg.sessionId) {
          resumeId.current[key] = msg.sessionId;
          migrateKey(key, msg.sessionId);
        }
        return;
      }
      case 'error': {
        const key = msg.sessionKey ?? activeRef.current; // erro sem key (top-level) não pode travar o spinner
        if (key) {
          delete runMsg.current[key];
          setPhases((p) => ({ ...p, [key]: 'idle' }));
          updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: `⚠️ ${msg.message}` }] }]);
        }
        return;
      }
    }
  }, [updateThread, patchRunMsg, migrateKey]);

  const connect = useCallback(() => {
    setConn((c) => ({ ...c, ws: 'reconnecting', sse: 'reconnecting' }));
    let ws: WebSocket;
    try { ws = new WebSocket(WS_URL); } catch { scheduleRetry(); return; }
    wsRef.current = ws;

    ws.onopen = () => {
      setConn({ ws: 'connected', sse: 'connected' });
      send({ t: 'list' });
      send({ t: 'list-archived' });
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
    retry.current = setTimeout(() => { retry.current = null; connect(); }, 1500);
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

  const onSend = useCallback((text: string) => {
    const key = activeRef.current;
    if (!key) return;
    const atts = attachmentsRef.current;
    // Anexos viram refs de path no início do prompt; o agente abre via Read.
    const wire = atts.length
      ? atts.map((a) => `[anexo: ${a.path}]`).join('\n') + '\n\n' + text
      : text;
    if (atts.length) { attachmentsRef.current = []; setAttachments([]); }
    updateThread(key, (prev) => [...prev, { id: newId('u'), role: 'user', text }]);
    setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: text, relative: 'agora' } : s)));
    setDrafts((d) => ({ ...d, [key]: '' }));
    send({ t: 'send', sessionKey: key, sessionId: resumeId.current[key], text: wire, mode: modeRef.current });
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

  const changeMode = useCallback((m: PermMode) => { modeRef.current = m; setMode(m); }, []);

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

  const onStop = useCallback(() => {
    const key = activeRef.current;
    if (!key) return;
    send({ t: 'stop', sessionKey: key });
    delete runMsg.current[key];
    setPhases((p) => ({ ...p, [key]: 'idle' }));
  }, [send]);

  const onNew = useCallback(() => {
    const id = newId('new-');
    const s: Session = { id, title: 'Nova sessão', relative: 'agora', snippet: 'Sem mensagens ainda', hasTerminal: false, active: true };
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
  const draft = drafts[activeId] || '';
  const contextTokens = usage[activeId] || 0;
  const setDraft = useCallback((v: string) => setDrafts((d) => ({ ...d, [activeRef.current]: v })), []);

  return { sessions, loading, activeId, setActiveId, messages, phase, draft, setDraft, conn, rate, stats, archived, contextTokens, searchResults, onSearch, contexts, openContext, onCtxList, onCtxOpen, onCtxClose, skills, openSkill, onSkillList, onSkillOpen, onSkillClose, attachments, onUpload, onRemoveAttachment, mode, setMode: changeMode, term, onSend, onStop, onNew, onRename, onClose, onUnhide };
}
