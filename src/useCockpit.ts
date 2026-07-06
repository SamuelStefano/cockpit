import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Session, Message, Block, ToolTodo } from './data/mock';
import type { ClientMsg, ServerMsg, SysStats, PermMode, Effort, ModelInfo, ContextMeta, SkillMeta, UsageStats, TurnStats, AdminHealth, Caps, PlanUsage, AccountSummary, Cron } from '../shared/protocol';
import { loadPref, savePref, setPref } from './lib/persist';
import { SUPABASE_ENABLED } from './lib/supabase';
import { requestNotifyPermission, notifyTurnDone, notifyTurnError } from './lib/notify';
import { wsUrlWithToken, newId, metaToSession, dedupById, mergeSeen } from './cockpit/session';
import { computeStalled, computeUpdated } from './cockpit/signals';
import { upsertTool, appendDelta, appendThinking } from './cockpit/blocks';
import { selectEvictions } from './cockpit/evict';
import { resolveKey, moveKey } from './cockpit/migrate';
import { mergeHistory } from './cockpit/history';
import { liveTokens } from './cockpit/live-tokens';
import { useTerminals, type TermApi } from './cockpit/useTerminals';
import { addThumb, shouldRequestThumb } from './lib/att-thumb-cache';
import { fileSig, isFreshUpload } from './components/chat/dedupe-uploads';
import { attachmentTextBlock } from './lib/parse-attachments';

export interface ContextDoc { id: string; title: string; body: string }
export interface SkillDoc { id: string; name: string; body: string }
export interface Attachment { name: string; path: string; text?: string; s3url?: string; uploading?: boolean; clientId?: string }
export interface AttachmentPreview { path: string; name: string; dataB64?: string; error?: string }
export type { TermApi };
import type { ConnState } from './components/primitives';
import type { Phase } from './components/Chat';

export interface Cockpit {
  sessions: Session[];
  loading: boolean;
  activeId: string;
  setActiveId: (id: string) => void;
  messages: Message[];
  terminalBusy: boolean;
  sessionTodos?: ToolTodo[];
  phase: Phase;
  running: Set<string>;
  stalled: Set<string>;
  updated: Set<string>;
  runStart: Record<string, number>;
  draft: string;
  setDraft: (v: string) => void;
  conn: { ws: ConnState; sse: ConnState };
  authRequired: boolean;
  agentOnline: boolean;
  submitToken: (token: string) => void;
  rate: { resetsAt: number; status: string } | null;
  planUsage: PlanUsage | null;
  stats: SysStats | null;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  claudeReady: boolean;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  effort: Effort;
  setEffort: (e: Effort) => void;
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  slashCommands: string[];
  term: TermApi;
  discoveredTerms: string[];
  listTerms: () => void;
  archived: Session[];
  contextTokens: number;
  liveTurnTokens: number;
  turnStartedAt?: number;
  usage: Record<string, number>;
  truncated: boolean;
  lastTurn?: TurnStats;
  lastEnd?: string;
  searchResults: Session[];
  onSearch: (q: string) => void;
  contexts: ContextMeta[];
  ctxLoaded: boolean;
  openContext: ContextDoc | null;
  onCtxList: () => void;
  onCtxOpen: (id: string) => void;
  onCtxClose: () => void;
  notes: string;
  notesLoaded: boolean;
  onNotesGet: () => void;
  onNotesSave: (text: string) => void;
  crons: Cron[];
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
  skills: SkillMeta[];
  skillsLoaded: boolean;
  openSkill: SkillDoc | null;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
  usageStats: UsageStats | null;
  onUsageList: () => void;
  health: AdminHealth | null;
  onHealthList: () => void;
  accounts: AccountSummary[];
  onAccountsList: () => void;
  onSetAdmin: (accountId: string, admin: boolean) => void;
  adminOp: { ok: boolean; message: string } | null;
  onEnvSet: (name: string, value: string) => void;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  attPreview: AttachmentPreview | null;
  onAttOpen: (path: string, name: string) => void;
  onAttClose: () => void;
  attThumbs: Record<string, string>;
  onAttThumb: (path: string) => void;
  onSend: (text: string, modeOverride?: PermMode, force?: 'priority') => void;
  onEditUser: (msgId: string, text: string) => void;
  onStop: (sessionKey?: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDescribe: (id: string, summary: string) => void;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onUnhide: (id: string) => void;
  onOpenFull: (id: string) => void;
  onOpenSummary: (id: string) => void;
}

export function useCockpit(): Cockpit {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string>('');
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>(() => loadPref('drafts', {} as Record<string, string>));
  const [phases, setPhases] = useState<Record<string, Phase>>({});
  // Espelho síncrono pro handler do WS (closure estável não enxerga o state).
  const phasesRef = useRef<Record<string, Phase>>({});
  useEffect(() => { phasesRef.current = phases; }, [phases]);
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
  const usageRef = useRef<Record<string, number>>({}); // espelho de `usage` p/ ler o contexto no início do turno sem depender do closure stale
  const turnBaseRef = useRef<Record<string, number>>({}); // sessionKey -> contexto no início do turno; o gasto AO VIVO do turno = contexto atual - base
  const [liveTurn, setLiveTurn] = useState<Record<string, number>>({}); // sessionKey -> tokens gastos NESTE turno (ao vivo), pro indicador estilo terminal
  const liveCharsRef = useRef<Record<string, number>>({}); // sessionKey -> chars de saída (texto+thinking) que já fizeram streaming neste turno; o CLI só reporta usage no fim, então estimamos os tokens AO VIVO daqui (~4 chars/token)
  const liveRealRef = useRef<Record<string, number>>({}); // sessionKey -> turnTokens REAL (incl. cache) reportado pelo server a cada chamada API; piso do ticker pra ele bater com o terminal (a estimativa por chars seria só centenas)
  const [truncated, setTruncated] = useState<Record<string, boolean>>({}); // sessionKey -> open dropou histórico antigo
  const [turnStats, setTurnStats] = useState<Record<string, TurnStats>>({}); // sessionKey -> custo/duração reais do último turno
  const [interrupted, setInterrupted] = useState<Record<string, string>>({}); // sessionKey -> endReason (budget/max_turns) p/ oferecer "continuar"
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const searchQ = useRef('');
  const [contexts, setContexts] = useState<ContextMeta[]>([]);
  // Lista vazia ≠ "ainda não chegou": o flag separa skeleton (esperando o 1º
  // snapshot) de estado vazio de verdade (zero contextos/skills no disco).
  const [ctxLoaded, setCtxLoaded] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [crons, setCrons] = useState<Cron[]>([]);
  const [openContext, setOpenContext] = useState<ContextDoc | null>(null);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [openSkill, setOpenSkill] = useState<SkillDoc | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [adminOp, setAdminOp] = useState<{ ok: boolean; message: string } | null>(null);
  const adminOpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);
  // Assinaturas recém-enviadas: chokepoint único de dedup (todos os caminhos de
  // anexo passam por onUpload). Mata o print/foto que chega repetido virando 4 chips.
  const recentUploadSigs = useRef<Map<string, number>>(new Map());
  // Config do upload direto na edge fn (URL+anon key), entregue pelo backend no
  // connect. null = S3 off → onUpload cai no fluxo via WS de sempre.
  const s3Config = useRef<{ uploadUrl: string; anonKey: string } | null>(null);
  // Helper: aplica uma mudança no array de anexos (estado + ref + persiste por sessão).
  const setAtts = useCallback((next: Attachment[]) => {
    attachmentsRef.current = next;
    setAttachments(next);
    const k = activeRef.current;
    if (k) savePref(`pendingAtts:${k}`, next.filter((a) => !a.uploading));
  }, []);
  const [attPreview, setAttPreview] = useState<AttachmentPreview | null>(null);
  const [attThumbs, setAttThumbs] = useState<Record<string, string>>({});
  const attThumbsRef = useRef<Record<string, string>>({});
  const thumbPending = useRef<Set<string>>(new Set());
  // Paths já pedidos NÃO re-pedem mesmo se expulsos do cache — evita livelock
  // de eviction quando as imagens montadas somam mais que o teto do cache.
  const thumbRequested = useRef<Set<string>>(new Set());
  const [mode, setMode] = useState<PermMode>(() => loadPref<PermMode>('mode', 'auto'));
  const modeRef = useRef<PermMode>(mode);
  const [caps, setCaps] = useState<Caps | null>(null);
  const capsRef = useRef<Caps | null>(null);
  // Default true: só mostramos o aviso quando o backend confirma ready:false, pra
  // não piscar um alerta assustador antes da 1ª mensagem (ou com backend antigo).
  const [claudeReady, setClaudeReady] = useState<boolean>(true);
  const [bypass, setBypass] = useState<boolean>(false); // nunca persistido: opt-in por sessão, default off
  const bypassRef = useRef<boolean>(false);
  const [model, setModel] = useState<string>(() => loadPref<string>('model', 'sonnet'));
  const modelRef = useRef<string>(model);
  const [models, setModels] = useState<ModelInfo[]>([]);
  // Nível de pensamento (--effort). Default 'low': sem isto o CLI usa o default da
  // conta (alto) e queima thinking tokens até em pedido simples — maior driver de gasto.
  const [effort, setEffort] = useState<Effort>(() => loadPref<Effort>('effort', 'low'));
  const effortRef = useRef<Effort>(effort);
  const [slashCommands, setSlashCommands] = useState<string[]>(() => loadPref<string[]>('slashCommands', []));
  // Skills selecionadas p/ os próximos prompts (ids). Vazio = todas ativas (default).
  // Persiste como pref global, igual modelo/teto; o ref deixa o onSend ler o atual.
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() => loadPref<string[]>('selectedSkills', []));
  const selectedSkillsRef = useRef<string[]>(selectedSkills);
  // MCP por sessão: default VAZIO = nenhum MCP (--strict-mcp-config no backend).
  // Cada server custa ~5-20k tokens/chamada; ligar só o necessário corta o gasto.
  const [selectedMcps, setSelectedMcps] = useState<string[]>(() => loadPref<string[]>('selectedMcps', []));
  const selectedMcpsRef = useRef<string[]>(selectedMcps);
  const [mcpServers, setMcpServers] = useState<string[]>([]); // nomes disponíveis (mensagem mcp-servers no connect)
  // sessionId -> mtime já visto. Sessão cujo mtime no servidor avançou além do
  // visto = "atualizada" (produziu output enquanto você não olhava — run noturno).
  const [seen, setSeen] = useState<Record<string, number>>(() => loadPref<Record<string, number>>('seen', {}));
  // Sessão ativa com escrita vinda de FORA do app (claude no terminal) há <5s.
  const [terminalBusyId, setTerminalBusyId] = useState<string | null>(null);
  // Snapshot corrente da lista de tarefas por sessão (vem no frame history).
  const [sessionTodos, setSessionTodos] = useState<Record<string, ToolTodo[]>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const runMsg = useRef<Record<string, string>>({});      // sessionKey -> assistant msgId em voo
  const inFlight = useRef<Set<string>>(new Set());        // sessionKeys com turno em voo — guarda síncrona contra envio duplo (runMsg só é setado no `started`)
  const stopping = useRef<Set<string>>(new Set());        // sessionKeys parados pelo usuário: o kill leva até 5s (SIGTERM→SIGKILL) e frames tardios re-acenderiam o phase. Limpo no `done`/`error`.
  const resumeId = useRef<Record<string, string>>({});    // sessionKey -> claude sessionId p/ --resume
  const opened = useRef<Set<string>>(new Set());          // sessionKeys cujo histórico já foi pedido
  const fullViewId = useRef<string | null>(null);         // sessão em "ver tudo": session-touched deve re-pedir open-full, não open
  const extBusyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // Relay T3: a VPS pareada está atendendo? No loopback (sem relay) estes frames
  // nunca chegam — default true, senão o dashboard de pareamento apareceria à toa.
  // No modo relay default FALSE: só depois do agent-online é que o chrome aparece;
  // senão a tela de pareamento era pulada antes de a VPS confirmar que atende.
  const [agentOnline, setAgentOnline] = useState(!SUPABASE_ENABLED);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const threadsRef = useRef<Record<string, Message[]>>(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  // Retorna se o frame realmente saiu: com WS fechado o descarte é silencioso, e
  // quem marca estado local condicionado ao envio (ex: opened) precisa saber.
  const send = useCallback((m: ClientMsg): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return false;
    ws.send(JSON.stringify(m));
    return true;
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

  // Ticker AO VIVO de tokens do turno (estilo terminal). O CLI só reporta usage no
  // fim, então estimamos a saída pelos chars que fazem streaming (~4 chars/token).
  // O número real do turno é carimbado na bolha no `done` (turnTokens).
  const bumpLiveTokens = useCallback((key: string, text: string) => {
    if (!text) return;
    liveCharsRef.current[key] = (liveCharsRef.current[key] || 0) + text.length;
    const est = liveTokens(Math.ceil(liveCharsRef.current[key] / 4), liveRealRef.current[key] ?? 0);
    setLiveTurn((l) => (l[key] === est ? l : { ...l, [key]: est }));
  }, []);

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
    if (stopping.current.has(oldKey)) { stopping.current.delete(oldKey); stopping.current.add(newId); }
    if (activeRef.current === oldKey) { activeRef.current = newId; setActiveIdState(newId); savePref('activeId', newId); }
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
    // O baseline de "visto" também migra: senão a entrada `new-…` ficava órfã pra
    // sempre no `seen` persistido (mergeSeen preserva todo `new-`), vazando no
    // localStorage a cada sessão nova; e a sessão migrada perdia o baseline (re-badge).
    setSeen((prev) => {
      if (!(oldKey in prev)) return prev;
      const next = moveKey(prev, oldKey, newId);
      savePref('seen', next);
      return next;
    });
    // A fila do composer (useChatPanel) é persistida por session.id na key 'queued'.
    // Sem migrar, o que foi enfileirado na sessão `new-…` ficava órfão e sumia da
    // tela quando a key migrava pro sessionId do Claude. setPref avisa o usePersisted.
    const q = loadPref<Record<string, string[]>>('queued', {});
    if (oldKey in q) setPref('queued', moveKey(q, oldKey, newId));
  }, []);

  const onServer = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'mcp-servers': { setMcpServers(msg.servers); return; }
      case 'caps': {
        capsRef.current = msg.caps;
        setCaps(msg.caps);
        // Servidor revogou a capacidade (flag off / não-admin): força o toggle off
        // pra a UI não anunciar um bypass que o backend recusaria de qualquer jeito.
        if (!msg.caps.canBypass) { bypassRef.current = false; setBypass(false); }
        return;
      }
      case 'claude-auth': { setClaudeReady(msg.ready); return; }
      case 'agent-online': { setAgentOnline(true); return; }
      case 'agent-offline': { setAgentOnline(false); return; }
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
        setThreads((prev) => ({ ...prev, [msg.sessionId]: mergeHistory(msg.messages, prev[msg.sessionId] ?? []) }));
        resumeId.current[msg.sessionId] = msg.sessionId;
        if (msg.tokens) setUsage((u) => ({ ...u, [msg.sessionId]: msg.tokens! }));
        // Estado corrente da lista de tarefas do ARQUIVO inteiro (pós-compact a
        // chain visível pode não ter nenhum snapshot) — alimenta o TaskTray.
        setSessionTodos((prev) => (msg.todos ? { ...prev, [msg.sessionId]: msg.todos } : prev));
        // `open` capa o caminho ativo e o full reload capa o arquivo inteiro, ambos
        // em historyLimit; o servidor manda `truncated` quando dropou as mais antigas.
        setTruncated((t) => ({ ...t, [msg.sessionId]: !!msg.truncated }));
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
      case 'session-touched': {
        // Atividade de fora do app (claude no terminal): se a sessão está aberta
        // e sem run DESTE app, re-puxa o histórico (mergeHistory deduplica). Se o
        // usuário está na visão completa, re-puxa o full — o 'open' simples
        // revertia silenciosamente pro resumido com o botão preso em "mostrar resumido".
        // Self-heal cirúrgico (squad): inFlight preso com phase JÁ idle é estado
        // contraditório — o done/error foi processado (ou se perdeu num reconnect)
        // mas a key ficou órfã, deixando a sessão surda pra session-touched pra
        // sempre. Timeout por inatividade foi rejeitado: tool longa (build de 90s)
        // não emite frame nenhum e seria falso positivo matando run vivo.
        if (inFlight.current.has(msg.sessionId) && phasesRef.current[msg.sessionId] === 'idle') {
          inFlight.current.delete(msg.sessionId);
          stopping.current.delete(msg.sessionId);
        }
        if (activeRef.current === msg.sessionId && !inFlight.current.has(msg.sessionId)) {
          send({ t: fullViewId.current === msg.sessionId ? 'open-full' : 'open', sessionId: msg.sessionId });
          // Escrita externa recente = turno do terminal em andamento: acende um
          // indicador no chat (estrelinha) que apaga 5s após a última escrita.
          setTerminalBusyId(msg.sessionId);
          if (extBusyTimer.current) clearTimeout(extBusyTimer.current);
          extBusyTimer.current = setTimeout(() => setTerminalBusyId(null), 5000);
        } else if (activeRef.current !== msg.sessionId) {
          // Sessão não-ativa: o thread cacheado ficou velho. Invalida o `opened`
          // pra próxima ativação re-pedir o history — sem isto mensagem mandada
          // pelo terminal só aparecia no F5, mesmo trocando de aba. Ativa+run em
          // voo fica de fora: invalidar ali faria o re-open do reconnect dropar a
          // bolha do stream (replay sem ts); o touch trailing pós-done já cobre.
          opened.current.delete(msg.sessionId);
        }
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
        setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: msg.text, relative: 'agora', mtime: Date.now() } : s)));
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
        // Início do turno: fixa a base de contexto pra medir o gasto AO VIVO deste
        // turno (delta) no indicador estilo terminal. Zera o contador exibido.
        turnBaseRef.current[key] = usageRef.current[key] || 0;
        liveCharsRef.current[key] = 0;
        liveRealRef.current[key] = 0;
        setLiveTurn((l) => ({ ...l, [key]: 0 }));
        return;
      }
      case 'replay': {
        // Reconnect mid-run (#10): snapshot autoritativo do turno em voo.
        // Reconstrói (ou sobrescreve) o bubble e segue recebendo deltas ao vivo.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        inFlight.current.add(key);
        // Reload mid-run zera runStartRef; sem semear daqui, o efeito do cronômetro
        // cravaria Date.now() e o card mostraria 0s pra um turno que já roda há min.
        if (msg.startedAt && runStartRef.current[key] === undefined) {
          runStartRef.current[key] = msg.startedAt;
          setRunStart((r) => ({ ...r, [key]: msg.startedAt! }));
        }
        const blocks: Block[] = [];
        if (msg.thinking) blocks.push({ type: 'thinking', text: msg.thinking });
        if (msg.text) blocks.push({ type: 'text', md: msg.text });
        for (const t of msg.tools) blocks.push({ type: 'tool', tool: t });
        let mid = runMsg.current[key];
        if (!mid) { mid = newId('a'); runMsg.current[key] = mid; }
        const id = mid;
        // ts no bubble de replay: sem ele, mergeHistory (ts >= lastTs) descartava a
        // bolha do turno EM VOO quando o history/open chegava logo depois — F5 no meio
        // do turno apagava a resposta viva e silenciava os deltas seguintes (RP#8).
        const ts = msg.startedAt ?? Date.now();
        updateThread(key, (prev) =>
          prev.some((m) => m.id === id)
            ? prev.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, blocks, ts } : m))
            : [...prev, { id, role: 'assistant', blocks, ts }],
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
        if (!stopping.current.has(key)) setPhases((p) => ({ ...p, [key]: 'streaming' }));
        patchRunMsg(key, (b) => appendDelta(b, msg.text));
        bumpLiveTokens(key, msg.text);
        return;
      }
      case 'thinking': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        if (!stopping.current.has(key)) setPhases((p) => ({ ...p, [key]: 'streaming' }));
        patchRunMsg(key, (b) => appendThinking(b, msg.text));
        bumpLiveTokens(key, msg.text);
        return;
      }
      case 'tool': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        lastActivity.current[key] = Date.now();
        if (!stopping.current.has(key)) setPhases((p) => ({ ...p, [key]: 'streaming' }));
        // Garante a bolha em voo: se um 'tool' chega antes do 'started' (ou o
        // started se perdeu), patchRunMsg descartaria o frame e o card — inclusive
        // o de AskUserQuestion — sumia. Cria a bolha pra o tool sempre anexar.
        if (!runMsg.current[key]) {
          const id = newId('a');
          runMsg.current[key] = id;
          updateThread(key, (prev) => [...prev, { id, role: 'assistant', blocks: [], ts: Date.now() }]);
        }
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
          // alias cru → versão concreta da família; id antigo/deprecado (não-alias,
          // fora da lista atual, ex: opus-4-7 salvo há meses, que seguia rodando e
          // queimando ~5x) → cai pro Sonnet econômico em vez de persistir caro.
          const upgrade = ['opus', 'sonnet', 'haiku'].includes(cur)
            ? msg.models.find((m) => m.id.includes(cur))
            : (msg.models.find((m) => m.id.includes('sonnet')) ?? msg.models[0]);
          if (upgrade) { modelRef.current = upgrade.id; setModel(upgrade.id); savePref('model', upgrade.id); }
        }
        return;
      }
      case 'usage': {
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        usageRef.current[key] = msg.tokens;
        setUsage((u) => ({ ...u, [key]: msg.tokens }));
        // `usage.tokens` é a janela de contexto. `turnTokens` é o gasto REAL do turno
        // até aqui (incl. cache): vira o piso do ticker ao vivo pra ele bater com o
        // terminal, em vez da estimativa por chars de saída (só centenas).
        if (msg.turnTokens && msg.turnTokens > 0) {
          liveRealRef.current[key] = msg.turnTokens;
          setLiveTurn((l) => ((l[key] ?? 0) >= msg.turnTokens! ? l : { ...l, [key]: msg.turnTokens! }));
        }
        return;
      }
      case 'compact': {
        // O CLI auto-compactou: a janela encolheu. Zera o medidor; o próximo turno
        // repopula com o tamanho real pós-compactação (DR-012). "Ver tudo" recupera
        // o pré-compactação — nada é perdido na verdade.
        const key = resolveKey(migratedTo.current, msg.sessionKey);
        usageRef.current[key] = 0;
        turnBaseRef.current[key] = 0;
        liveCharsRef.current[key] = 0;
        liveRealRef.current[key] = 0; // senão o piso pré-compactação ressurge o ticker
        setUsage((u) => ({ ...u, [key]: 0 }));
        setLiveTurn((l) => ({ ...l, [key]: 0 }));
        // Divisor visível na thread (estilo Claude Code) marcando ONDE compactou.
        updateThread(key, (prev) => {
          const last = prev[prev.length - 1];
          if (!msg.kind && last && last.role === 'compact' && !last.kind) return prev;
          return [...prev, { id: `compact-${Date.now()}`, role: 'compact', trigger: msg.trigger, preTokens: msg.preTokens, kind: msg.kind, label: msg.label, ts: Date.now() }];
        });
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
      case 'notes': {
        setNotes(msg.text);
        setNotesLoaded(true);
        return;
      }
      case 'crons': {
        setCrons(msg.items);
        return;
      }
      case 'contexts': {
        setContexts(msg.items);
        setCtxLoaded(true);
        return;
      }
      case 'context': {
        setOpenContext({ id: msg.id, title: msg.title, body: msg.body });
        return;
      }
      case 'skills': {
        setSkills(msg.items);
        setSkillsLoaded(true);
        return;
      }
      case 'skill': {
        setOpenSkill({ id: msg.id, name: msg.name, body: msg.body });
        return;
      }
      case 'usage-stats': {
        // O server devolve EMPTY_STATS (tudo zero) quando o SQLite está em lock
        // (db.usageStats() cai no fallback). Não apaga um painel já populado por
        // causa de um snapshot vazio transitório — só substitui se vier dado real
        // ou se ainda não temos nada. Vazio = sem amostras, sessões e série.
        const s = msg.stats;
        const empty = s.totalSamples === 0 && s.sessions.length === 0 && s.series.length === 0;
        setUsageStats((prev) => (empty && prev && prev.totalSamples > 0 ? prev : s));
        return;
      }
      case 'health': {
        setHealth(msg.health);
        return;
      }
      case 'accounts': {
        setAccounts(msg.accounts);
        return;
      }
      case 'admin-op': {
        setAdminOp({ ok: msg.ok, message: msg.message });
        // Auto-limpa o banner: sem isto um "salvo"/erro fica preso no painel até a
        // próxima op ou reload (a UI nunca reseta o estado). Erro fica mais tempo.
        if (adminOpTimer.current) clearTimeout(adminOpTimer.current);
        adminOpTimer.current = setTimeout(() => setAdminOp(null), msg.ok ? 4000 : 8000);
        return;
      }
      case 's3-config': {
        s3Config.current = { uploadUrl: msg.uploadUrl, anonKey: msg.anonKey };
        return;
      }
      case 'uploaded': {
        const real: Attachment = { name: msg.name, path: msg.path, text: msg.text, s3url: msg.s3url };
        const cur = attachmentsRef.current;
        // Reconcilia o chip otimista (uploading) pelo clientId — substitui no lugar
        // em vez de duplicar. Sem clientId (upload via WS antigo) só anexa.
        const idx = msg.clientId ? cur.findIndex((a) => a.clientId === msg.clientId) : -1;
        setAtts(idx >= 0 ? cur.map((a, i) => (i === idx ? real : a)) : [...cur, real]);
        return;
      }
      case 'attachment': {
        // Só preenche se o modal aberto ainda é o desse path — o usuário pode ter
        // fechado ou aberto outro anexo enquanto o conteúdo viajava pela WS.
        // No sucesso o servidor manda o nome original (sem o prefixo ts-hex do
        // disco) — preferimos ele; no erro vem o path cru, então fica o do chip.
        setAttPreview((prev) => (prev && prev.path === msg.path ? { ...prev, name: msg.error ? prev.name : msg.name, dataB64: msg.dataB64, error: msg.error } : prev));
        // Só resposta pedida pelo CHIP entra no cache de thumbnails (delete
        // retorna true). Abrir um pdf/vídeo grande no modal não pode poluir o
        // cache e expulsar as thumbs de imagem. Erro também não entra.
        if (thumbPending.current.delete(msg.path) && msg.dataB64 && !msg.error) {
          attThumbsRef.current = addThumb(attThumbsRef.current, msg.path, msg.dataB64);
          setAttThumbs(attThumbsRef.current);
        }
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
        stopping.current.delete(key);
        reconcileTools(key);
        // Carimba o modelo EFETIVO do turno na bolha (revela --fallback-model e
        // evita rotular bolhas antigas com o modelo atual ao trocar mid-thread).
        const aid = runMsg.current[key];
        if (aid && (msg.model || msg.costUsd !== undefined || msg.durationMs !== undefined || msg.turnTokens !== undefined)) {
          // Carimba modelo + stats do turno (gasto/tempo/tokens) na bolha pra
          // exibição discreta. stats só existe quando o result trouxe algum número.
          const stats = (msg.costUsd !== undefined || msg.durationMs !== undefined || msg.turnTokens !== undefined)
            ? { costUsd: msg.costUsd, durationMs: msg.durationMs, tokens: msg.turnTokens, inputTokens: msg.inputTokens, outputTokens: msg.outputTokens }
            : undefined;
          updateThread(key, (prev) => prev.map((m) => (m.id === aid && m.role === 'assistant' ? { ...m, ...(msg.model ? { model: msg.model } : {}), ...(stats ? { stats } : {}) } : m)));
        }
        delete runMsg.current[key];
        delete turnBaseRef.current[key];
        delete liveCharsRef.current[key];
        delete liveRealRef.current[key];
        setLiveTurn((l) => { if (!(key in l)) return l; const n = { ...l }; delete n[key]; return n; });
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
        // Stop do usuário também fecha o turno via 'done' (limpa o phase), mas é
        // interrupção deliberada — não notificar "turno concluído".
        if (msg.stopped) return;
        const id = msg.sessionId ?? key;
        notifyTurnDone(
          sessionsRef.current.find((s) => s.id === id || s.id === key)?.title ?? '',
          () => {
            if (fullViewId.current !== id) fullViewId.current = null;
            activeRef.current = id;
            setActiveIdState(id);
            if (attachmentsRef.current.length) { setAtts([]); }
            setAttPreview(null);
            setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === id })));
            if (id && !id.startsWith('new-') && !opened.current.has(id) && send({ t: 'open', sessionId: id })) opened.current.add(id);
          },
        );
        return;
      }
      case 'error': {
        // Erro escopado a um turno (tem sessionKey) → encerra ESSE turno e mostra.
        // Erro sem key (top-level: authz negada, rate-limit) NÃO pode tocar o turno
        // ativo: o `delete runMsg.current` matava o ponteiro da bolha em voo e os
        // deltas seguintes eram descartados em patchRunMsg ("conectou mas não chega
        // resposta"). Keyless → só notifica, sem mexer no estado de nenhum run.
        const key = (msg.sessionKey && migratedTo.current[msg.sessionKey]) || msg.sessionKey;
        if (key) {
          inFlight.current.delete(key);
          stopping.current.delete(key);
          reconcileTools(key);
          delete runMsg.current[key];
          delete turnBaseRef.current[key];
          delete liveCharsRef.current[key];
          delete liveRealRef.current[key];
          setLiveTurn((l) => { if (!(key in l)) return l; const n = { ...l }; delete n[key]; return n; });
          setPhases((p) => ({ ...p, [key]: 'idle' }));
          updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: `⚠️ ${msg.message}` }], error: true }]);
          notifyTurnError(
            sessionsRef.current.find((s) => s.id === key)?.title ?? '',
            msg.message,
            () => {
              if (fullViewId.current !== key) fullViewId.current = null;
              activeRef.current = key;
              setActiveIdState(key);
              if (attachmentsRef.current.length) { setAtts([]); }
              setAttPreview(null);
              setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === key })));
            },
          );
        } else {
          notifyTurnError(sessionsRef.current.find((s) => s.id === activeRef.current)?.title ?? '', msg.message);
        }
        return;
      }
    }
  }, [updateThread, patchRunMsg, migrateKey, reconcileTools, send, onTermData, onTermReplay, onTermExit, onTerms]);

  const connect = useCallback(() => {
    // Fecha+neutraliza o socket anterior ANTES de abrir outro. Sem isto, sockets
    // antigos ainda OPEN seguem com onmessage→onServer ativos: cada frame do relay
    // é processado 1× por socket vivo (terminal e deltas TRIPLICAM). E o onclose de
    // um socket velho dispararia outro connect, acumulando ainda mais.
    const prev = wsRef.current;
    if (prev) {
      prev.onopen = prev.onmessage = prev.onerror = null;
      prev.onclose = null;                       // o velho não re-agenda reconnect
      try { prev.close(); } catch { /* noop */ }
    }
    setConn((c) => ({ ...c, ws: 'reconnecting', sse: 'reconnecting' }));
    let ws: WebSocket;
    try { ws = new WebSocket(wsUrlWithToken(tokenRef.current)); } catch { scheduleRetry(); return; }
    wsRef.current = ws;

    // Guarda de geração: só o socket ATUAL (wsRef.current) reage. Um evento tardio
    // de um socket que já foi substituído não pode mexer no estado nem reconectar.
    const isCurrent = () => wsRef.current === ws;
    ws.onopen = () => {
      if (!isCurrent()) return;
      retryDelay.current = 1500; // reconectou — zera o backoff
      setAuthRequired(false); // token válido (ou gate desligado)
      // Pedidos de thumb que morreram com o socket anterior podem re-pedir.
      for (const p of thumbPending.current) thumbRequested.current.delete(p);
      thumbPending.current.clear();
      setConn({ ws: 'connected', sse: 'connected' });
      send({ t: 'list' });
      send({ t: 'list-archived' });
      send({ t: 'usage-list' });
      send({ t: 'skill-list' }); // popula o seletor de skills do composer
      send({ t: 's3-config' });  // URL+anon key pra upload HTTP direto na edge fn
      // Sessão ativada enquanto o WS esteve fechado nunca recebeu o 'open' (frame
      // descartado) — sem isto o thread visível ficava vazio até um F5.
      const act = activeRef.current;
      if (act && !act.startsWith('new-') && !opened.current.has(act) && send({ t: 'open', sessionId: act })) opened.current.add(act);
      reattach();
    };
    ws.onmessage = (ev) => {
      if (!isCurrent()) return;
      let m: ServerMsg;
      try { m = JSON.parse(String(ev.data)) as ServerMsg; } catch { return; }
      onServer(m);
    };
    ws.onclose = (ev) => {
      if (!isCurrent()) return;
      setConn({ ws: 'down', sse: 'down' });
      // 4401 = servidor exige token e o nosso falta/está errado. NÃO re-tenta em
      // loop: mostra o login. Qualquer outro código = queda de rede → backoff.
      if (ev.code === 4401) { setAuthRequired(true); return; }
      // 1009 = frame grande demais (ex: anexo que estourou o maxPayload de um hop).
      // O socket caía e reconectava sem explicação (parecia queda de rede em loop).
      // Mostra erro claro e reconecta pra restaurar (o frame ofensor não é reenviado).
      if (ev.code === 1009) {
        const key = activeRef.current;
        // O frame que estourou era o upload inline (fallback WS) — tira o chip preso
        // em "uploading" senão o spinner roda pra sempre.
        if (attachmentsRef.current.some((a) => a.uploading)) {
          attachmentsRef.current = attachmentsRef.current.filter((a) => !a.uploading);
          setAttachments(attachmentsRef.current);
        }
        if (key) updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: '⚠️ Arquivo grande demais para enviar pela conexão — anexe um arquivo menor.' }], error: true }]);
      }
      scheduleRetry();
    };
    ws.onerror = () => { if (isCurrent()) { try { ws.close(); } catch { /* noop */ } } };
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

  // Login: guarda o token e reconecta na hora com ele. Chamado pelo gate de auth e
  // por todo onAuthStateChange do Supabase. Se o token não mudou e já existe um
  // socket vivo, não derruba a conexão à toa — senão o SIGNED_IN inicial (mesmo
  // token já persistido) fecharia o socket ainda CONNECTING ("closed before
  // established") e o TOKEN_REFRESHED periódico reconectaria sem necessidade.
  const submitToken = useCallback((token: string) => {
    const t = token.trim();
    if (t === tokenRef.current && wsRef.current) return;
    tokenRef.current = t;
    savePref('auth.token', t);
    setAuthRequired(false);
    retryDelay.current = 1500;
    if (retry.current) { clearTimeout(retry.current); retry.current = null; }
    // Derruba o socket anterior NEUTRALIZANDO o onclose antes — senão o close
    // dispara scheduleRetry e reabre uma conexão com a credencial recém-trocada
    // (no sign-out, vazia), gerando churn de reconnect-rejeitado.
    const prev = wsRef.current;
    if (prev) {
      prev.onopen = prev.onmessage = prev.onerror = prev.onclose = null;
      try { prev.close(); } catch { /* noop */ }
      wsRef.current = null;
    }
    // Sign-out no modo relay (token vazio): fica desconectado, não rediscar — o
    // relay rejeitaria sem credencial e o gate de login assume.
    if (SUPABASE_ENABLED && !t) { setConn({ ws: 'down', sse: 'down' }); return; }
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  useEffect(() => {
    // Com Supabase ligado (relay), só disca depois que o login alimentar o token —
    // conectar antes manda um socket sem credencial pro relay, que o derruba na hora
    // e gera o churn de reconnect. submitToken (via onAuthStateChange) chama connect()
    // assim que a sessão resolve. No loopback (Supabase off) conecta de cara como sempre.
    if (!(SUPABASE_ENABLED && !tokenRef.current)) connect();
    return () => {
      if (retry.current) clearTimeout(retry.current);
      if (adminOpTimer.current) clearTimeout(adminOpTimer.current);
      if (extBusyTimer.current) clearTimeout(extBusyTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveId = useCallback((id: string) => {
    // Espelha o reset do fullLoaded no painel (useChatPanel zera na troca de sid):
    // a visão completa é um modo transitório por visita, não preferência da sessão.
    if (fullViewId.current !== id) fullViewId.current = null;
    activeRef.current = id;
    setActiveIdState(id);
    // Sessão real (não rascunho local) vira a última ativa — sobrevive ao F5.
    if (id && !id.startsWith('new-')) savePref('activeId', id);
    // Reidrata os anexos pendentes da sessão alvo (persistidos por sessão) em vez de
    // só limpar — assim trocar de sessão / dar F5 não some com os anexos do composer.
    const pend = id ? loadPref<Attachment[]>(`pendingAtts:${id}`, []) : [];
    attachmentsRef.current = pend;
    setAttachments(pend);
    // Modal de preview é transitório da sessão: trocar via Alt+↑/↓ com ele aberto
    // deixava o anexo da sessão anterior na tela da nova.
    setAttPreview(null);
    setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === id })));
    if (id && !id.startsWith('new-') && !opened.current.has(id) && send({ t: 'open', sessionId: id })) opened.current.add(id);
  }, [send]);

  const onSend = useCallback((text: string, modeOverride?: PermMode, force?: 'priority') => {
    const key = activeRef.current;
    if (!key) return;
    // WS fechado: send() descartaria em silêncio DEPOIS do trabalho otimista —
    // bolha na tela, composer limpo e o servidor nunca recebeu nada. Guard antes
    // de qualquer mutação: avisa e devolve o texto pro composer.
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: '⚠️ Sem conexão com o servidor — a mensagem não foi enviada. O texto voltou pro composer; tente de novo quando reconectar.' }], error: true }]);
      // O submit do composer chama setValue('') logo após onSend; o microtask
      // re-despacha o restore por último, senão o texto restaurado era apagado.
      queueMicrotask(() => setDrafts((d) => ({ ...d, [key]: d[key] || text })));
      return;
    }
    // Turno em voo: NÃO bloqueia mais. O servidor tria o prompt (esperar/responder/
    // prioridade/juntar) — ver routeSend. A bolha do usuário entra otimista e o
    // 'started' do próximo turno (ou da prioridade) cria o bubble do assistente.
    const busy = inFlight.current.has(key);
    if (!busy) inFlight.current.add(key);
    stopping.current.delete(key); // novo prompt nesta sessão cancela o latch de stop
    requestNotifyPermission(); // 1ª vez: pede permissão (gesto do usuário)
    // Só anexos JÁ confirmados entram no prompt — um chip 'uploading' tem path
    // temporário (clientId) que o agente não conseguiria abrir.
    const atts = attachmentsRef.current.filter((a) => !a.uploading);
    // Anexos viram refs de path no início do prompt; o agente abre via Read. Pra
    // .docx (binário que o Read não parseia) o texto extraído vai inline logo após
    // o ref — o agente recebe o conteúdo direto e o chip segue no .docx original.
    const wire = atts.length
      ? atts.map((a) => (a.text ? `[anexo: ${a.path}]\n${attachmentTextBlock(a.name, a.text)}` : `[anexo: ${a.path}]`)).join('\n') + '\n\n' + text
      : text;
    if (atts.length) { setAtts([]); }
    setInterrupted((p) => { if (!(key in p)) return p; const n = { ...p }; delete n[key]; return n; });
    // Add otimista (feedback instantâneo, sem round-trip). O servidor ecoa esta
    // mensagem com o MESMO msgId pra todos os clientes; este aqui deduplica por id.
    const msgId = newId('u');
    // Bolha otimista usa o texto decorado (com linhas `[anexo:]`): parseAttachments
    // mostra os chips na hora, igual ao reload do JSONL. Com `text` limpo os anexos
    // só apareciam após F5.
    updateThread(key, (prev) => [...prev, { id: msgId, role: 'user', text: wire, ts: Date.now() }]);
    setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: text, relative: 'agora', mtime: Date.now() } : s)));
    setDrafts((d) => ({ ...d, [key]: '' }));
    // bypass só vai no fio quando o servidor anunciou a capacidade (admin + env +
    // loopback). O backend reimpõe via bypassAllowed — isto é só pra não anunciar
    // um pedido que seria recusado.
    const bypassWire = capsRef.current?.canBypass && bypassRef.current ? true : undefined;
    // skills só vai no fio quando o usuário restringiu (subconjunto); vazio = todas.
    const skillsWire = selectedSkillsRef.current.length ? selectedSkillsRef.current : undefined;
    const mcpsWire = selectedMcpsRef.current.length ? selectedMcpsRef.current : undefined;
    send({ t: 'send', sessionKey: key, sessionId: resumeId.current[key], text: wire, msgId, mode: modeOverride ?? modeRef.current, model: modelRef.current, effort: effortRef.current, bypass: bypassWire, skills: skillsWire, mcps: mcpsWire, force });
  }, [send, updateThread]);

  const onUpload = useCallback((file: File) => {
    const key = activeRef.current;
    if (!key) return;
    // Mesmo arquivo chegando repetido (FileList duplicado do iOS, re-disparo de
    // paste/change, caminhos concorrentes) só sobe uma vez dentro da janela.
    if (!isFreshUpload(recentUploadSigs.current, fileSig(file), Date.now())) return;
    const clientId = newId('up');
    // Chip otimista na hora (com spinner) — antes só aparecia DEPOIS do ack do
    // servidor, sem feedback durante o upload. O 'uploaded' reconcilia pelo clientId.
    setAtts([...attachmentsRef.current, { name: file.name, path: clientId, clientId, uploading: true }]);
    let done = false;
    const fail = (msg: string) => {
      if (done) return; done = true;
      setAtts(attachmentsRef.current.filter((a) => a.clientId !== clientId));
      updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: msg }], error: true }]);
    };
    // Watchdog: o chip NUNCA fica "carregando" pra sempre. Se em 75s ainda estiver
    // uploading (fetch pendurado, sem ack do backend, relay dropou), some + erro.
    setTimeout(() => {
      if (!done && attachmentsRef.current.some((a) => a.clientId === clientId && a.uploading)) {
        fail(`⚠️ Upload de "${file.name}" demorou demais — tente de novo.`);
      }
    }, 75_000);
    // Upload em CHUNKS via WS: fatia o base64 em pedaços pequenos (cada frame bem
    // abaixo do cap do relay), o backend remonta e sobe pro S3 server-side. Evita o
    // upload direto browser→edge fn (travava por CORS/Cloudflare) e o cap de frame.
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const b64 = res.includes(',') ? res.slice(res.indexOf(',') + 1) : res;
      const CHUNK = 700_000; // ~700KB de base64 por frame (folga sob o cap do relay)
      const total = Math.max(1, Math.ceil(b64.length / CHUNK));
      for (let seq = 0; seq < total; seq++) {
        send({ t: 'upload-chunk', uploadId: clientId, sessionKey: key, name: file.name, seq, total, dataB64: b64.slice(seq * CHUNK, (seq + 1) * CHUNK), clientId });
      }
    };
    reader.onerror = reader.onabort = () => fail(`⚠️ Falha ao ler o arquivo "${file.name}" — tente anexar de novo.`);
    reader.readAsDataURL(file);
  }, [send, updateThread, setAtts]);

  const onRemoveAttachment = useCallback((path: string) => {
    setAtts(attachmentsRef.current.filter((a) => a.path !== path));
  }, [setAtts]);

  const changeMode = useCallback((m: PermMode) => { modeRef.current = m; setMode(m); savePref('mode', m); }, []);
  const changeBypass = useCallback((b: boolean) => { bypassRef.current = b; setBypass(b); }, []);
  const changeModel = useCallback((m: string) => { modelRef.current = m; setModel(m); savePref('model', m); }, []);
  const changeEffort = useCallback((e: Effort) => { effortRef.current = e; setEffort(e); savePref('effort', e); }, []);
  const changeSelectedSkills = useCallback((ids: string[]) => { selectedSkillsRef.current = ids; setSelectedSkills(ids); savePref('selectedSkills', ids); }, []);
  const changeSelectedMcps = useCallback((ids: string[]) => { selectedMcpsRef.current = ids; setSelectedMcps(ids); savePref('selectedMcps', ids); }, []);

  // Busca por conteúdo: dispara no backend (grep) e guarda o termo p/ descartar
  // respostas atrasadas. <2 chars limpa os resultados.
  const onSearch = useCallback((q: string) => {
    searchQ.current = q;
    if (q.trim().length < 2) { setSearchResults([]); return; }
    send({ t: 'search', q });
  }, [send]);

  const onAttOpen = useCallback((path: string, name: string) => {
    setAttPreview({ path, name });
    send({ t: 'att-open', path });
  }, [send]);
  const onAttClose = useCallback(() => setAttPreview(null), []);
  const onAttThumb = useCallback((path: string) => {
    if (!shouldRequestThumb(attThumbsRef.current, thumbPending.current, thumbRequested.current, path)) return;
    thumbRequested.current.add(path);
    thumbPending.current.add(path);
    send({ t: 'att-open', path });
  }, [send]);
  const onNotesGet = useCallback(() => send({ t: 'notes-get' }), [send]);
  const onNotesSave = useCallback((text: string) => send({ t: 'notes-save', text }), [send]);
  const onCronsGet = useCallback(() => send({ t: 'crons-get' }), [send]);
  const onCronSave = useCallback((cron: Cron) => send({ t: 'cron-save', cron }), [send]);
  const onCronDelete = useCallback((id: string) => send({ t: 'cron-delete', id }), [send]);
  const onCronRun = useCallback((id: string) => send({ t: 'cron-run', id }), [send]);
  const onCtxList = useCallback(() => send({ t: 'ctx-list' }), [send]);
  const onCtxOpen = useCallback((id: string) => send({ t: 'ctx-open', id }), [send]);
  const onCtxClose = useCallback(() => setOpenContext(null), []);
  const onSkillList = useCallback(() => send({ t: 'skill-list' }), [send]);
  const onSkillOpen = useCallback((id: string) => send({ t: 'skill-open', id }), [send]);
  const onSkillClose = useCallback(() => setOpenSkill(null), []);
  const onUsageList = useCallback(() => send({ t: 'usage-list' }), [send]);
  const onRefreshModels = useCallback(() => send({ t: 'refresh-models' }), [send]);
  const onHealthList = useCallback(() => send({ t: 'admin-health' }), [send]);
  // Painel admin de contas (T3): listar usuários e ligar/desligar admin. Tratado
  // NO RELAY (service-role); o gate de papel é lá. No loopback estes frames não têm
  // handler e a UI fica escondida (só aparece com Supabase ligado).
  const onAccountsList = useCallback(() => send({ t: 'accounts-list' }), [send]);
  const onSetAdmin = useCallback((accountId: string, admin: boolean) => send({ t: 'set-admin', accountId, admin }), [send]);
  const onEnvSet = useCallback((name: string, value: string) => send({ t: 'admin-env-set', name, value }), [send]);
  const onEnvUnset = useCallback((name: string) => send({ t: 'admin-env-unset', name }), [send]);
  const onMcpAdd = useCallback((name: string, opts: { command?: string; url?: string }) => send({ t: 'admin-mcp-add', name, command: opts.command, url: opts.url }), [send]);
  const onMcpRemove = useCallback((name: string) => send({ t: 'admin-mcp-remove', name }), [send]);
  const onCliInstall = useCallback((name: string) => send({ t: 'admin-cli-install', name }), [send]);

  const onStop = useCallback((sessionKey?: string) => {
    const key = sessionKey ?? activeRef.current;
    if (!key) return;
    send({ t: 'stop', sessionKey: key });
    inFlight.current.delete(key);
    stopping.current.add(key);
    reconcileTools(key);
    delete runMsg.current[key];
    setPhases((p) => ({ ...p, [key]: 'idle' }));
  }, [send, reconcileTools]);

  // Editar mensagem do usuário: substitui no lugar e reenvia, em vez de enfileirar
  // uma nova bolha no fim. Reusa o MESMO msgId — o eco 'user' do servidor deduplica
  // por id, então a bolha não duplica. Turno em voo é parado antes (o servidor trata
  // "stop → send" como turno novo, não triagem), e as respostas à versão antiga,
  // que ficam obsoletas, são descartadas.
  const editUser = useCallback((msgId: string, text: string) => {
    const key = activeRef.current;
    const clean = text.trim();
    if (!key || !clean) return;
    // Mesmo guard do onSend: com WS fechado o send() descarta em silêncio — aqui
    // seria pior, o thread já teria sido TRUNCADO no slice abaixo. Nada muda;
    // o texto editado vai pro composer pra não se perder.
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      updateThread(key, (prev) => [...prev, { id: newId('e'), role: 'assistant', blocks: [{ type: 'text', md: '⚠️ Sem conexão com o servidor — a edição não foi aplicada. O texto editado foi pro composer.' }], error: true }]);
      setDrafts((d) => ({ ...d, [key]: d[key] || clean }));
      return;
    }
    if (inFlight.current.has(key)) onStop(key);
    inFlight.current.add(key);
    stopping.current.delete(key);
    updateThread(key, (prev) => {
      const idx = prev.findIndex((m) => m.id === msgId && m.role === 'user');
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), { ...prev[idx], text: clean, triage: undefined, ts: Date.now() }];
    });
    setSessions((prev) => prev.map((s) => (s.id === key ? { ...s, snippet: clean, relative: 'agora', mtime: Date.now() } : s)));
    const bypassWire = capsRef.current?.canBypass && bypassRef.current ? true : undefined;
    const skillsWire = selectedSkillsRef.current.length ? selectedSkillsRef.current : undefined;
    const mcpsWire = selectedMcpsRef.current.length ? selectedMcpsRef.current : undefined;
    send({ t: 'send', sessionKey: key, sessionId: resumeId.current[key], text: clean, msgId, mode: modeRef.current, model: modelRef.current, bypass: bypassWire, skills: skillsWire, mcps: mcpsWire });
  }, [send, updateThread, onStop]);

  const onNew = useCallback(() => {
    const id = newId('new-');
    const s: Session = { id, title: 'Nova sessão', relative: 'agora', snippet: 'Sem mensagens ainda', mtime: Date.now(), hasTerminal: false, active: true };
    setSessions((prev) => [s, ...prev.map((x) => ({ ...x, active: false }))]);
    setThreads((prev) => ({ ...prev, [id]: [] }));
    fullViewId.current = null;
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
      fullViewId.current = null;
      activeRef.current = fb;
      setActiveIdState(fb);
      if (attachmentsRef.current.length) { setAtts([]); }
      setAttPreview(null);
      if (fb && !fb.startsWith('new-') && !opened.current.has(fb) && send({ t: 'open', sessionId: fb })) opened.current.add(fb);
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
    fullViewId.current = id;
    send({ t: 'open-full', sessionId: id });
  }, [send]);

  // Volta do histórico completo pro resumido (só o caminho ativo, capado em
  // historyLimit). É o inverso de onOpenFull — sem isto o botão "ver tudo" era
  // mão-única (carregava tudo e não dava pra recolher).
  const onOpenSummary = useCallback((id: string) => {
    if (!id || id.startsWith('new-')) return;
    if (fullViewId.current === id) fullViewId.current = null;
    send({ t: 'open', sessionId: id });
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

  // Watchdog: enquanto algo roda, tica a cada 5s pra recomputar "quietas". O dot
  // só APARECE via este tick (sessão parada não muda phases→running, então o memo
  // não recomputa sozinho); 20s deixava o sinal até 20s atrasado. 5s aperta isso
  // sem custo — só re-renderiza enquanto há run vivo.
  useEffect(() => {
    if (running.size === 0) return;
    const id = setInterval(() => setClockTick((n) => n + 1), 5_000);
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
  const liveTurnTokens = liveTurn[activeId] || 0;
  const turnStartedAt = runStart[activeId];
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

  return { sessions, loading, activeId, setActiveId, messages, phase, terminalBusy: terminalBusyId === activeId, sessionTodos: sessionTodos[activeId], running, stalled, updated, runStart, draft, setDraft, conn, authRequired, agentOnline, submitToken, rate, planUsage, stats, archived, contextTokens, liveTurnTokens, turnStartedAt, usage, truncated: !!truncated[activeId], lastTurn, lastEnd, searchResults, onSearch, contexts, ctxLoaded, openContext, onCtxList, onCtxOpen, onCtxClose, notes, notesLoaded, onNotesGet, onNotesSave, crons, onCronsGet, onCronSave, onCronDelete, onCronRun, skills, skillsLoaded, openSkill, onSkillList, onSkillOpen, onSkillClose, usageStats, onUsageList, health, onHealthList, accounts, onAccountsList, onSetAdmin, adminOp, onEnvSet, onEnvUnset, onMcpAdd, onMcpRemove, onCliInstall, attachments, onUpload, onRemoveAttachment, attPreview, onAttOpen, onAttClose, attThumbs, onAttThumb, mode, setMode: changeMode, caps, claudeReady, bypass, setBypass: changeBypass, model, setModel: changeModel, models, onRefreshModels, effort, setEffort: changeEffort, selectedSkills, setSelectedSkills: changeSelectedSkills, mcpServers, selectedMcps, setSelectedMcps: changeSelectedMcps, slashCommands, term, discoveredTerms, listTerms, onSend, onEditUser: editUser, onStop, onNew, onRename, onDescribe, onClose, onDelete, onUnhide, onOpenFull, onOpenSummary };
}
