import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Session, Message, Block } from './data/mock';
import type { ClientMsg, ServerMsg, SysStats, PermMode, ModelInfo, ContextMeta, SkillMeta, UsageStats, TurnStats, AdminHealth, Caps, PlanUsage } from '../shared/protocol';
import { loadPref, savePref } from './lib/persist';
import { requestNotifyPermission, notifyTurnDone, notifyTurnError } from './lib/notify';
import { wsUrlWithToken, newId, metaToSession, dedupById, mergeSeen } from './cockpit/session';
import { computeStalled, computeUpdated } from './cockpit/signals';
import { upsertTool, appendDelta, appendThinking } from './cockpit/blocks';
import { selectEvictions } from './cockpit/evict';
import { resolveKey, moveKey } from './cockpit/migrate';
import { useTerminals, type TermApi } from './cockpit/useTerminals';

export interface ContextDoc { id: string; title: string; body: string }
export interface SkillDoc { id: string; name: string; body: string }
export interface Attachment { name: string; path: string }
export type { TermApi };
import type { ConnState } from './components/primitives';
import type { Phase } from './components/Chat';

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
  runStart: Record<string, number>;
  draft: string;
  setDraft: (v: string) => void;
  conn: { ws: ConnState; sse: ConnState };
  authRequired: boolean;
  submitToken: (token: string) => void;
  rate: { resetsAt: number; status: string } | null;
  planUsage: PlanUsage | null;
  stats: SysStats | null;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  budget: number;
  setBudget: (n: number) => void;
  slashCommands: string[];
  term: TermApi;
  discoveredTerms: string[];
  listTerms: () => void;
  archived: Session[];
  contextTokens: number;
  usage: Record<string, number>;
  truncated: boolean;
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
  health: AdminHealth | null;
  onHealthList: () => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onStop: (sessionKey?: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDescribe: (id: string, summary: string) => void;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onUnhide: (id: string) => void;
  onOpenFull: (id: string) => void;
}

export function useCockpit(): Cockpit {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string>('');
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>(() => loadPref('drafts', {} as Record<string, string>));
  const [phases, setPhases] = useState<Record<string, Phase>>({});
  const lastActivity = useRef<Record<string, number>>({}); // sessionKey -> ts do último frame; alimenta o watchdog de "sessão quieta"
  const runStartRef = useRef<Record<string, number>>({}); // sessionKey -> ts em que o turno começou; alimenta o cronômetro do card
  const [runStart, setRunStart] = useState<Record<string, number>>({});
  const [clockTick, setClockTick] = useState(0); // re-render periódico p/ recomputar quietas sem novo evento
  const [conn, setConn] = useState<{ ws: ConnState; sse: ConnState }>({ ws: 'reconnecting', sse: 'reconnecting' });
  const [rate, setRate] = useState<{ resetsAt: number; status: string } | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [stats, setStats] = useState<SysStats | null>(null);
  const [archived, setArchived] = useState<Session[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({}); // sessionKey -> tokens de contexto
  const [truncated, setTruncated] = useState<Record<string, boolean>>({}); // sessionKey -> open dropou histórico antigo
  const [turnStats, setTurnStats] = useState<Record<string, TurnStats>>({}); // sessionKey -> custo/duração reais do último turno
  const [interrupted, setInterrupted] = useState<Record<string, string>>({}); // sessionKey -> endReason (budget/max_turns) p/ oferecer "continuar"
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const searchQ = useRef('');
  const [contexts, setContexts] = useState<ContextMeta[]>([]);
  const [openContext, setOpenContext] = useState<ContextDoc | null>(null);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [openSkill, setOpenSkill] = useState<SkillDoc | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);
  const [mode, setMode] = useState<PermMode>(() => loadPref<PermMode>('mode', 'auto'));
  const modeRef = useRef<PermMode>(mode);
  const [caps, setCaps] = useState<Caps | null>(null);
  const capsRef = useRef<Caps | null>(null);
  const [bypass, setBypass] = useState<boolean>(false); // nunca persistido: opt-in por sessão, default off
  const bypassRef = useRef<boolean>(false);
  const [model, setModel] = useState<string>(() => loadPref<string>('model', 'opus'));
  const modelRef = useRef<string>(model);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [budget, setBudget] = useState<number>(() => loadPref<number>('budget', 0)); // 0 = sem teto
  const budgetRef = useRef<number>(budget);
  const [slashCommands, setSlashCommands] = useState<string[]>(() => loadPref<string[]>('slashCommands', []));
  // sessionId -> mtime já visto. Sessão cujo mtime no servidor avançou além do
  // visto = "atualizada" (produziu output enquanto você não olhava — run noturno).
  const [seen, setSeen] = useState<Record<string, number>>(() => loadPref<Record<string, number>>('seen', {}));

  const wsRef = useRef<WebSocket | null>(null);
  const runMsg = useRef<Record<string, string>>({});      // sessionKey -> assistant msgId em voo
  const inFlight = useRef<Set<string>>(new Set());        // sessionKeys com turno em voo — guarda síncrona contra envio duplo (runMsg só é setado no `started`)
  const resumeId = useRef<Record<string, string>>({});    // sessionKey -> claude sessionId p/ --resume
  const opened = useRef<Set<string>>(new Set());          // sessionKeys cujo histórico já foi pedido
  const migratedTo = useRef<Record<string, string>>({});  // new-xxx -> claude sessionId já migrado (idempotência: 2º `done` não re-migra nem zera o thread)
  const activeRef = useRef('');
  const sessionsRef = useRef<Session[]>([]);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1500); // backoff exponencial, reset no connect bem-sucedido
  // Token de auth (DR-011 Fase 2). Só é exigido quando o servidor tem COCKPIT_TOKEN
  // setado; aí uma conexão sem token (ou errado) volta com close code 4401 e a UI
  // pede o token. Guardado em ref pra o connect() ler o valor atual sem recriar o
  // callback (que reabriria o socket a cada digitação).
  const tokenRef = useRef<string>(loadPref<string>('auth.token', ''));
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const threadsRef = useRef<Record<string, Message[]>>(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  const send = useCallback((m: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  }, []);

  const { term, onTermData, onTermReplay, onTermExit, onTerms, discovered: discoveredTerms, listTerms, reattach } = useTerminals(send);

  const updateThread = useCallback((key: string, fn: (prev: Message[]) => Message[]) => {
    setThreads((prev) => ({ ...prev, [key]: fn(prev[key] || []) }));
  }, []);

  const patchRunMsg = useCallback((key: string, fn: (blocks: Block[]) => Block[]) => {
    const mid = runMsg.current[key];
    if (!mid) return;
    updateThread(key, (prev) => prev.map((m) => (m.id === mid && m.role === 'assistant' ? { ...m, blocks: fn(m.blocks) } : m)));
  }, [updateThread]);

  // Turno encerrado (done/error/stop) sem o tool_result de uma ferramenta em voo:
  // o card ficaria girando "running" pra sempre. Marca as órfãs como encerradas.
  const reconcileTools = useCallback((key: string) => {
    updateThread(key, (prev) => prev.map((m) =>
      m.role === 'assistant'
        ? { ...m, blocks: m.blocks.map((b) => (b.type === 'tool' && b.tool.status === 'running' ? { type: 'tool', tool: { ...b.tool, status: 'error' as const } } : b)) }
        : m,
    ));
  }, [updateThread]);

  // Sessão local `new-xxx` ganha um uuid real do claude só no fim do 1º run.
  // Migrar a key local -> uuid evita que ela apareça DUPLICADA no sidebar quando
  // o `list` (reconnect) trouxer a mesma sessão já persistida no JSONL.
  // Migra-se no `done` (não no meio): assim nenhum delta/tool em voo (ainda
  // keyed por `new-xxx`) fica órfão.
  const migrateKey = useCallback((oldKey: string, newId: string) => {
    if (oldKey === newId || !oldKey.startsWith('new-')) return;
    // Idempotência: o servidor pode emitir `done` duas vezes p/ o mesmo turno.
    // Sem isto, o 2º done re-roda reconcileTools(oldKey) (recria threads[oldKey]
    // VAZIO) e re-migra, zerando o thread real — o chat some após o run.
    if (migratedTo.current[oldKey]) return;
    migratedTo.current[oldKey] = newId;
    resumeId.current[newId] = newId;
    delete resumeId.current[oldKey];
    opened.current.add(newId);   // history já está local; não re-buscar
    opened.current.delete(oldKey);
    if (oldKey in lastActivity.current) { lastActivity.current[newId] = lastActivity.current[oldKey]; delete lastActivity.current[oldKey]; }
    // Sem migrar runStartRef, o efeito do cronômetro re-registra Date.now() na key
    // nova e o tempo decorrido do card zera no meio do 1º turno.
    if (oldKey in runStartRef.current) { runStartRef.current[newId] = runStartRef.current[oldKey]; delete runStartRef.current[oldKey]; }
    if (inFlight.current.has(oldKey)) { inFlight.current.delete(oldKey); inFlight.current.add(newId); }
    if (activeRef.current === oldKey) { activeRef.current = newId; setActiveIdState(newId); }
    const move = <T,>(prev: Record<string, T>): Record<string, T> => moveKey(prev, oldKey, newId);
    setThreads(move);
    setPhases(move);
    setDrafts(move);
    setUsage(move);
    setTurnStats(move);
    setInterrupted(move);
    // Se o `list` já trouxe newId como linha persistida, renomear oldKey->newId
    // criaria DUAS linhas com o mesmo id. Renomeia a local e remove a duplicata
    // do servidor (a local carrega o estado em voo, então fica preferida).
    setSessions((prev) => dedupById(prev.map((s) => (s.id === oldKey ? { ...s, id: newId } : s))));
  }, []);

  const onServer = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'caps': {
        capsRef.current = msg.caps;
        setCaps(msg.caps);
        // Servidor revogou a capacidade (flag off / não-admin): força o toggle off
        // pra a UI não anunciar um bypass que o backend recusaria de qualquer jeito.
        if (!msg.caps.canBypass) { bypassRef.current = false; setBypass(false); }
        return;
      }
      case 'sessions': {
        setSessions((prev) => {
          const localOnly = prev.filter((s) => s.id.startsWith('new-'));
          const fromServer = msg.items.map((m) => metaToSession(m, m.id === activeRef.current));
          return [...localOnly, ...fromServer];
        });
        // Baseline: sessão vista pela 1ª vez entra no `seen` com o mtime atual
        // (não vira "atualizada" retroativamente). Só mtime que AVANÇA depois badgeia.
        setSeen((prev) => {
          const { next, changed } = mergeSeen(prev, msg.items);
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
        // `open` capa o caminho ativo em historyLimit e dropa as mais antigas; o
        // full reload traz tudo. Marca/limpa pra UI avisar que falta histórico.
        setTruncated((t) => ({ ...t, [msg.sessionId]: msg.full ? false : !!msg.truncated }));
        return;
      }
      case 'busy': {
        // Snapshot autoritativo do servidor (envia no connect): quais keys têm
        // run vivo. Reconcilia o phases local — cobre sessões que ESTE cliente
        // não iniciou (run noturno, outra aba) e limpa keys que já terminaram.
        const live = new Set(msg.keys);
        // Reconcilia a guarda síncrona: descarta keys que ficaram presas (envio
        // enquanto desconectado nunca recebeu started/done) e marca as vivas.
        for (const k of [...inFlight.current]) if (!live.has(k)) inFlight.current.delete(k);
        for (const k of msg.keys) inFlight.current.add(k);
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
      case 'user': {
        // Eco do servidor: o cliente que enviou já tem a bolha (add otimista) e
        // deduplica por id; uma 2ª aba/dispositivo não tem e anexa — é o que torna
        // a mensagem do usuário tempo-real entre clientes (antes só aparecia no F5).
        // Frame tardio keyed pelo `new-xxx` antigo é redirecionado p/ a key real
        // já migrada (senão recria um thread/linha fantasma).
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        updateThread(key, (prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, { id: msg.id, role: 'user', text: msg.text, ts: msg.ts }],
        );
        setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: msg.text, relative: 'agora' } : s)));
        return;
      }
      case 'triage': {
        // Veredito da triagem (prompt enviado com o turno ocupado). Anexa o selo na
        // bolha do usuário correspondente. Em 'priority' o turno atual será morto e
        // substituído: solta o runMsg p/ o próximo 'started' criar um bubble novo
        // (senão o turno novo fundiria no bubble interrompido).
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        if (msg.msgId) {
          updateThread(key, (prev) =>
            prev.map((m) => (m.id === msg.msgId && m.role === 'user' ? { ...m, triage: { action: msg.action, reason: msg.reason } } : m)),
          );
        }
        if (msg.action === 'priority') delete runMsg.current[key];
        return;
      }
      case 'quick-answer': {
        // Subagente respondeu à parte (triagem 'answer'); bolha independente, não
        // toca o turno principal em andamento.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        updateThread(key, (prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, { id: msg.id, role: 'assistant', blocks: [{ type: 'text', md: msg.text }], ts: msg.ts, quick: true }],
        );
        return;
      }
      case 'started': {
        // Frame tardio do turno antigo pode chegar keyed pelo `new-xxx` já migrado.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        inFlight.current.add(key);
        if (runMsg.current[key]) return; // já em voo (reconnect) — não duplica bubble
        const id = newId('a');
        runMsg.current[key] = id;
        updateThread(key, (prev) => [...prev, { id, role: 'assistant', blocks: [], ts: Date.now() }]);
        setPhases((p) => ({ ...p, [key]: 'thinking' }));
        return;
      }
      case 'replay': {
        // Reconnect mid-run (#10): snapshot autoritativo do turno em voo.
        // Reconstrói (ou sobrescreve) o bubble e segue recebendo deltas ao vivo.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        inFlight.current.add(key);
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
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        if (msg.sessionId) resumeId.current[key] = msg.sessionId;
        return;
      }
      case 'slash-commands': {
        setSlashCommands(msg.items);
        savePref('slashCommands', msg.items);
        return;
      }
      case 'delta': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        setPhases((p) => ({ ...p, [key]: 'streaming' }));
        patchRunMsg(key, (b) => appendDelta(b, msg.text));
        return;
      }
      case 'thinking': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        setPhases((p) => ({ ...p, [key]: 'streaming' }));
        patchRunMsg(key, (b) => appendThinking(b, msg.text));
        return;
      }
      case 'tool': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        setPhases((p) => ({ ...p, [key]: 'streaming' }));
        patchRunMsg(key, (b) => upsertTool(b, msg.tool));
        return;
      }
      case 'rate': {
        setRate({ resetsAt: msg.resetsAt, status: msg.status });
        return;
      }
      case 'plan-usage': {
        setPlanUsage(msg.usage);
        return;
      }
      case 'models': {
        setModels(msg.models);
        // Se a sessão ainda está num alias cru (opus/sonnet/haiku), promove pra a
        // versão concreta mais recente daquela família (ex: opus → claude-opus-4-8).
        const cur = modelRef.current;
        if (msg.models.length && !msg.models.some((m) => m.id === cur)) {
          const upgrade = ['opus', 'sonnet', 'haiku'].includes(cur)
            ? msg.models.find((m) => m.id.includes(cur))
            : undefined;
          if (upgrade) { modelRef.current = upgrade.id; setModel(upgrade.id); savePref('model', upgrade.id); }
        }
        return;
      }
      case 'usage': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        setUsage((u) => ({ ...u, [key]: msg.tokens }));
        return;
      }
      case 'compact': {
        // O CLI auto-compactou: a janela encolheu. Zera o medidor; o próximo turno
        // repopula com o tamanho real pós-compactação (DR-012). "Ver tudo" recupera
        // o pré-compactação — nada é perdido na verdade.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        setUsage((u) => ({ ...u, [key]: 0 }));
        return;
      }
      case 'session-summary': {
        setSessions((prev) => prev.map((s) => (s.id === msg.sessionId ? { ...s, summary: msg.summary } : s)));
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
      case 'health': {
        setHealth(msg.health);
        return;
      }
      case 'uploaded': {
        const next = [...attachmentsRef.current, { name: msg.name, path: msg.path }];
        attachmentsRef.current = next;
        setAttachments(next);
        return;
      }
      case 'term-data': {
        onTermData(msg.termId, msg.data);
        return;
      }
      case 'term-replay': {
        onTermReplay(msg.termId, msg.data);
        return;
      }
      case 'terms': {
        onTerms(msg.ids);
        break;
      }
      case 'term-exit': {
        onTermExit(msg.termId);
        return;
      }
      case 'done': {
        // `done` duplicado após a migração chega keyed pelo `new-xxx` antigo;
        // redireciona p/ o id real já migrado pra não tocar uma key órfã.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        inFlight.current.delete(key);
        reconcileTools(key);
        // Carimba o modelo EFETIVO do turno na bolha (revela --fallback-model e
        // evita rotular bolhas antigas com o modelo atual ao trocar mid-thread).
        const aid = runMsg.current[key];
        if (aid && msg.model) {
          updateThread(key, (prev) => prev.map((m) => (m.id === aid && m.role === 'assistant' ? { ...m, model: msg.model } : m)));
        }
        delete runMsg.current[key];
        setPhases((p) => ({ ...p, [key]: 'idle' }));
        if (msg.costUsd !== undefined || msg.durationMs !== undefined) {
          setTurnStats((t) => ({ ...t, [key]: { costUsd: msg.costUsd, durationMs: msg.durationMs, numTurns: msg.numTurns, model: msg.model } }));
        }
        const resumable = !!msg.endReason && (msg.endReason.includes('budget') || msg.endReason.includes('max_turns'));
        if (msg.endReason && msg.endReason !== 'success') {
          const note = msg.endReason.includes('budget')
            ? `⚠️ Turno interrompido: teto de gasto atingido${msg.costUsd !== undefined ? ` ($${msg.costUsd.toFixed(3)})` : ''}.`
            : msg.endReason.includes('max_turns')
              ? '⚠️ Turno interrompido: limite de turnos atingido.'
              : `⚠️ Turno encerrado (${msg.endReason}).`;
          // Corte recuperável (budget/max_turns) → nota cinza + banner "Continuar".
          // Subtype de erro genuíno (error_during_execution etc.) → marca error
          // pra a UI oferecer "reenviar" em vez de só uma nota muda. (#307 cobre
          // só o exit code≠0 pós-result; o erro reportado pelo próprio result
          // ainda precisa do retry.)
          updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: note }], error: !resumable }]);
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
        // Resolve a key migrada antes do fallback p/ a sessão ativa.
        const key = (msg.sessionKey && migratedTo.current[msg.sessionKey]) || msg.sessionKey || activeRef.current; // erro sem key (top-level) não pode travar o spinner
        if (key) {
          inFlight.current.delete(key);
          reconcileTools(key);
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
  }, [updateThread, patchRunMsg, migrateKey, reconcileTools, send, onTermData, onTermReplay, onTermExit, onTerms]);

  const connect = useCallback(() => {
    setConn((c) => ({ ...c, ws: 'reconnecting', sse: 'reconnecting' }));
    let ws: WebSocket;
    try { ws = new WebSocket(wsUrlWithToken(tokenRef.current)); } catch { scheduleRetry(); return; }
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = 1500; // reconectou — zera o backoff
      setAuthRequired(false); // token válido (ou gate desligado)
      setConn({ ws: 'connected', sse: 'connected' });
      send({ t: 'list' });
      send({ t: 'list-archived' });
      send({ t: 'usage-list' });
      reattach();
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(ev.data)) as ServerMsg; } catch { return; }
      onServer(m);
    };
    ws.onclose = (ev) => {
      setConn({ ws: 'down', sse: 'down' });
      // 4401 = servidor exige token e o nosso falta/está errado. NÃO re-tenta em
      // loop: mostra o login. Qualquer outro código = queda de rede → backoff.
      if (ev.code === 4401) { setAuthRequired(true); return; }
      scheduleRetry();
    };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, onServer, reattach]);

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

  // Login: guarda o token e reconecta na hora com ele. Chamado pelo gate de auth.
  const submitToken = useCallback((token: string) => {
    const t = token.trim();
    tokenRef.current = t;
    savePref('auth.token', t);
    setAuthRequired(false);
    retryDelay.current = 1500;
    if (retry.current) { clearTimeout(retry.current); retry.current = null; }
    try { wsRef.current?.close(); } catch { /* noop */ }
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

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
    // Turno em voo: NÃO bloqueia mais. O servidor tria o prompt (esperar/responder/
    // prioridade/juntar) — ver routeSend. A bolha do usuário entra otimista e o
    // 'started' do próximo turno (ou da prioridade) cria o bubble do assistente.
    const busy = inFlight.current.has(key);
    if (!busy) inFlight.current.add(key);
    requestNotifyPermission(); // 1ª vez: pede permissão (gesto do usuário)
    const atts = attachmentsRef.current;
    // Anexos viram refs de path no início do prompt; o agente abre via Read.
    const wire = atts.length
      ? atts.map((a) => `[anexo: ${a.path}]`).join('\n') + '\n\n' + text
      : text;
    if (atts.length) { attachmentsRef.current = []; setAttachments([]); }
    setInterrupted((p) => { if (!(key in p)) return p; const n = { ...p }; delete n[key]; return n; });
    // Add otimista (feedback instantâneo, sem round-trip). O servidor ecoa esta
    // mensagem com o MESMO msgId pra todos os clientes; este aqui deduplica por id.
    const msgId = newId('u');
    updateThread(key, (prev) => [...prev, { id: msgId, role: 'user', text, ts: Date.now() }]);
    setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: text, relative: 'agora' } : s)));
    setDrafts((d) => ({ ...d, [key]: '' }));
    // bypass só vai no fio quando o servidor anunciou a capacidade (admin + env +
    // loopback). O backend reimpõe via bypassAllowed — isto é só pra não anunciar
    // um pedido que seria recusado.
    const bypassWire = capsRef.current?.canBypass && bypassRef.current ? true : undefined;
    send({ t: 'send', sessionKey: key, sessionId: resumeId.current[key], text: wire, msgId, mode: modeOverride ?? modeRef.current, model: modelRef.current, maxBudgetUsd: budgetRef.current > 0 ? budgetRef.current : undefined, bypass: bypassWire });
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
  const changeBypass = useCallback((b: boolean) => { bypassRef.current = b; setBypass(b); }, []);
  const changeModel = useCallback((m: string) => { modelRef.current = m; setModel(m); savePref('model', m); }, []);
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
  const onHealthList = useCallback(() => send({ t: 'admin-health' }), [send]);

  const onStop = useCallback((sessionKey?: string) => {
    const key = sessionKey ?? activeRef.current;
    if (!key) return;
    send({ t: 'stop', sessionKey: key });
    inFlight.current.delete(key);
    reconcileTools(key);
    delete runMsg.current[key];
    setPhases((p) => ({ ...p, [key]: 'idle' }));
  }, [send, reconcileTools]);

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
    // Persiste no servidor (override em store.json) só p/ sessão real; `new-`
    // ainda não tem JSONL/UUID, fica só local até virar sessão de verdade.
    if (id && !id.startsWith('new-')) send({ t: 'set-meta', sessionId: id, title });
  }, []);

  // Descrição manual da sessão (ganha do resumo IA). Mesma regra do rename.
  const onDescribe = useCallback((id: string, summary: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, summary } : s)));
    if (id && !id.startsWith('new-')) send({ t: 'set-meta', sessionId: id, summary });
  }, []);

  // Fechar = arquivar. Sessão real -> backend esconde do list (não deleta JSONL);
  // sessão local `new-` (sem history) -> só remove da view. Some na hora; se era
  // a ativa, cai pra próxima (abrindo o history dela).
  // Remoção local do sidebar (some na hora, escolhe fallback ativo, limpa estado
  // por sessão). Compartilhada por arquivar e excluir — só muda a msg ao backend.
  const dropFromSidebar = useCallback((id: string) => {
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
    setTurnStats((prev) => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n; });
    setInterrupted((prev) => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n; });
    delete runMsg.current[id];
    delete resumeId.current[id];
    delete migratedTo.current[id];
    // ...e o ponteiro por VALOR (entrada keyed pelo `new-xxx` cujo alvo é este id).
    for (const ok in migratedTo.current) if (migratedTo.current[ok] === id) delete migratedTo.current[ok];
    delete runStartRef.current[id];
    delete lastActivity.current[id];
    opened.current.delete(id);
  }, [send]);

  const onClose = useCallback((id: string) => {
    if (id && !id.startsWith('new-')) send({ t: 'hide', sessionId: id });
    dropFromSidebar(id);
  }, [send, dropFromSidebar]);

  // Excluir: some do cockpit por completo (nem em Arquivadas). O .jsonl no disco
  // permanece — exclusão é só do app.
  const onDelete = useCallback((id: string) => {
    if (id && !id.startsWith('new-')) send({ t: 'purge', sessionId: id });
    dropFromSidebar(id);
  }, [send, dropFromSidebar]);

  // Desarquivar: backend reenvia sessions + archived; some da lista de arquivadas
  // na hora e reaparece no sidebar principal.
  const onUnhide = useCallback((id: string) => {
    setArchived((prev) => prev.filter((s) => s.id !== id));
    send({ t: 'unhide', sessionId: id });
  }, [send]);

  // Recarrega o histórico COMPLETO (em ordem de arquivo, inclui pré-compactação)
  // sobre o thread ativo. O 'open' normal só traz o caminho parentUuid ativo, então
  // mensagens antes de um /compact somem — este botão recupera tudo.
  const onOpenFull = useCallback((id: string) => {
    if (!id || id.startsWith('new-')) return;
    send({ t: 'open-full', sessionId: id });
  }, [send]);

  const messages = threads[activeId] || [];
  const phase = phases[activeId] || 'idle';
  // Sessões com run vivo (pra dot pulsante no sidebar) — útil em run noturno
  // multi-sessão: ver de relance quem ainda trabalha sem abrir cada uma.
  const running = useMemo(
    () => new Set(Object.keys(phases).filter((k) => phases[k] === 'thinking' || phases[k] === 'streaming')),
    [phases]
  );
  // Marca o início do turno por sessão (idle→running) e limpa no fim, pra o card
  // do sidebar mostrar há quanto tempo aquela sessão trabalha.
  useEffect(() => {
    const cur = runStartRef.current;
    let changed = false;
    for (const k of running) if (cur[k] === undefined) { cur[k] = Date.now(); changed = true; }
    for (const k of Object.keys(cur)) if (!running.has(k)) { delete cur[k]; changed = true; }
    if (changed) setRunStart({ ...cur });
  }, [running]);
  // LRU de threads: numa aba aberta por semanas (daily driver), cada sessão
  // visitada deixa o Message[] inteiro em memória pra sempre. Acima do teto,
  // despeja as mais antigas por atividade — nunca a ativa, nem com run vivo, nem
  // locais `new-`. Reabrir re-busca o history do JSONL (tira do `opened`).
  const THREAD_CAP = 30;
  useEffect(() => {
    const drop = selectEvictions(Object.keys(threadsRef.current), {
      active: activeRef.current,
      cap: THREAD_CAP,
      running,
      inFlight: inFlight.current,
      lastActivity: lastActivity.current,
    });
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
    setTurnStats((t) => (drop.some((k) => k in t) ? prune(t) : t));
    setInterrupted((p) => (drop.some((k) => k in p) ? prune(p) : p));
    for (const k of drop) {
      delete lastActivity.current[k];
      delete resumeId.current[k];
      delete runMsg.current[k];
      delete runStartRef.current[k];
    }
    // migratedTo é keyed pelo `new-xxx` (valor = id real); despejar o id real
    // tem que limpar o ponteiro por VALOR, senão o mapa cresce sem teto numa aba
    // de dias e um frame tardio `new-xxx` ressuscitaria a sessão já despejada.
    for (const ok in migratedTo.current) if (drop.includes(migratedTo.current[ok])) delete migratedTo.current[ok];
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
    void clockTick;
    return computeStalled(running, lastActivity.current, Date.now());
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
    () => computeUpdated(sessions, seen, activeId, running),
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

  return { sessions, loading, activeId, setActiveId, messages, phase, running, stalled, updated, runStart, draft, setDraft, conn, authRequired, submitToken, rate, planUsage, stats, archived, contextTokens, usage, truncated: !!truncated[activeId], lastTurn, lastEnd, searchResults, onSearch, contexts, openContext, onCtxList, onCtxOpen, onCtxClose, skills, openSkill, onSkillList, onSkillOpen, onSkillClose, usageStats, onUsageList, health, onHealthList, attachments, onUpload, onRemoveAttachment, mode, setMode: changeMode, caps, bypass, setBypass: changeBypass, model, setModel: changeModel, models, budget, setBudget: changeBudget, slashCommands, term, discoveredTerms, listTerms, onSend, onStop, onNew, onRename, onDescribe, onClose, onDelete, onUnhide, onOpenFull };
}
