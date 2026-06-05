import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session, Message, Block } from './data/mock';
import type { ClientMsg, ServerMsg, SessionMeta, ToolCall, SysStats, PermMode } from '../shared/protocol';
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
  attach: (id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void) => void;
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
  onSend: (text: string) => void;
  onStop: () => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
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
  const [mode, setMode] = useState<PermMode>('plan');
  const modeRef = useRef<PermMode>('plan');

  const wsRef = useRef<WebSocket | null>(null);
  const runMsg = useRef<Record<string, string>>({});      // sessionKey -> assistant msgId em voo
  const resumeId = useRef<Record<string, string>>({});    // sessionKey -> claude sessionId p/ --resume
  const opened = useRef<Set<string>>(new Set());          // sessionKeys cujo histórico já foi pedido
  const activeRef = useRef('');
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termData = useRef<Map<string, (d: string) => void>>(new Map());   // termId -> xterm.write
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
      case 'stats': {
        setStats(msg.stats);
        return;
      }
      case 'term-data': {
        termData.current.get(msg.termId)?.(msg.data);
        return;
      }
      case 'term-exit': {
        termExit.current.get(msg.termId)?.();
        return;
      }
      case 'done': {
        if (msg.sessionId) resumeId.current[msg.sessionKey] = msg.sessionId;
        delete runMsg.current[msg.sessionKey];
        setPhases((p) => ({ ...p, [msg.sessionKey]: 'idle' }));
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
  }, [updateThread, patchRunMsg]);

  const connect = useCallback(() => {
    setConn((c) => ({ ...c, ws: 'reconnecting', sse: 'reconnecting' }));
    let ws: WebSocket;
    try { ws = new WebSocket(WS_URL); } catch { scheduleRetry(); return; }
    wsRef.current = ws;

    ws.onopen = () => {
      setConn({ ws: 'connected', sse: 'connected' });
      send({ t: 'list' });
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
    setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === id })));
    if (id && !id.startsWith('new-') && !opened.current.has(id)) {
      opened.current.add(id);
      send({ t: 'open', sessionId: id });
    }
  }, [send]);

  const onSend = useCallback((text: string) => {
    const key = activeRef.current;
    if (!key) return;
    updateThread(key, (prev) => [...prev, { id: newId('u'), role: 'user', text }]);
    setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: text, relative: 'agora' } : s)));
    setDrafts((d) => ({ ...d, [key]: '' }));
    send({ t: 'send', sessionKey: key, sessionId: resumeId.current[key], text, mode: modeRef.current });
  }, [send, updateThread]);

  const changeMode = useCallback((m: PermMode) => { modeRef.current = m; setMode(m); }, []);

  const term: TermApi = {
    attach: useCallback((id, cols, rows, onData, onExit) => {
      termData.current.set(id, onData);
      termExit.current.set(id, onExit);
      termDims.current.set(id, { cols, rows });
      send({ t: 'term-open', termId: id, cols, rows });
    }, [send]),
    detach: useCallback((id) => {
      termData.current.delete(id);
      termExit.current.delete(id);
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

  const messages = threads[activeId] || [];
  const phase = phases[activeId] || 'idle';
  const draft = drafts[activeId] || '';
  const setDraft = useCallback((v: string) => setDrafts((d) => ({ ...d, [activeRef.current]: v })), []);

  return { sessions, loading, activeId, setActiveId, messages, phase, draft, setDraft, conn, rate, stats, mode, setMode: changeMode, term, onSend, onStop, onNew, onRename };
}
