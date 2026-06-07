import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, Badge } from './primitives';
import { MessageRow, Thinking } from './chat/MessageView';
import { ExportMenu, TurnStat, ContextMeter } from './chat/Toolbar';
import { shortModel } from './chat/toolbar.format';
import { ChatEmpty, ChatInput } from './chat/ChatInput';
import type { Session, Message } from '../data/mock';
import type { PermMode, ModelInfo, TurnStats, Caps } from '../../shared/protocol';
import type { Attachment } from '../useCockpit';



// --- ChatPanel -------------------------------------------------------------

export type Phase = 'idle' | 'thinking' | 'streaming';

export interface ChatPanelProps {
  session: Session | null;
  messages: Message[];
  phase: Phase;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onPrompt: (text: string) => void;
  onStop: () => void;
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
  contextTokens: number;
  lastTurn?: TurnStats;
  onNew: () => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onEditUser?: (text: string) => void;
  onQuote?: (text: string) => void;
  onOpenFull?: (id: string) => void;
  truncated?: boolean;
  onShowHelp?: () => void;
  lastEnd?: string;
  focusSignal?: number;
  onTerminal?: () => void;
  terminalRunning?: boolean;
}

export function ChatPanel({ session, messages, phase, draft, setDraft, onSend, onPrompt, onStop, mode, setMode, caps, bypass, setBypass, model, setModel, models, budget, setBudget, slashCommands, contextTokens, lastTurn, lastEnd, onNew, attachments, onUpload, onRemoveAttachment, onEditUser, onQuote, onOpenFull, truncated, onShowHelp, focusSignal = 0, onTerminal, terminalRunning }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [queued, setQueued] = useState('');
  const [fullLoaded, setFullLoaded] = useState(false);
  useEffect(() => { setFullLoaded(false); }, [session?.id]);
  const streaming = phase === 'streaming';
  const disabled = phase !== 'idle';
  const sentHistory = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean),
    [messages],
  );
  const modelLabel = useMemo(
    () => models.find((m) => m.id === model)?.displayName || model,
    [models, model],
  );
  // Rótulo POR bolha: usa o modelo carimbado naquele turno (done/JSONL) e cai
  // pro modelo atual da sessão só quando a bolha não tem modelo (sessão antiga).
  const labelFor = useMemo(
    () => (id?: string) => (id ? models.find((m) => m.id === id)?.displayName || shortModel(id) : modelLabel),
    [models, modelLabel],
  );

  // Fila stop-aware: mensagem digitada durante o turno dispara sozinha no idle.
  useEffect(() => {
    if (phase === 'idle' && queued) {
      const text = queued;
      setQueued('');
      onSend(text);
    }
  }, [phase, queued, onSend]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinnedRef.current = near;
    setAtBottom(near);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, phase]);

  const isEmpty = messages.length === 0;
  const planPending = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.blocks.some((b) => b.type === 'tool' && b.tool.name === 'ExitPlanMode');
  })();
  const failed = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.error === true;
  })();
  const retryLast = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') { onSend(m.text); return; }
    }
  };
  // Enter na composição vazia confirma o banner visível (aprovar plano / retomar
  // / reenviar) — a ação que o usuário quase sempre quer ali. Mesma precedência
  // da renderização: falha > plano > corte de teto.
  const bannerConfirm = failed
    ? retryLast
    : planPending
      ? () => onSend('Plano aprovado — prossiga com a implementação.', 'acceptEdits')
      : (phase === 'idle' && lastEnd)
        ? () => onSend('Continue de onde você parou e termine a tarefa.')
        : undefined;

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        <Icon name="message" size={14} className="text-neutral-500" />
        <span className="truncate text-[12.5px] font-medium text-neutral-300">{session ? session.title : 'Nova sessão'}</span>
        {session?.hasTerminal && <Badge tone="green" dot className="ml-0.5">terminal</Badge>}
        {/* Cluster direito num só container: vários ml-auto irmãos se espalham
            (margens auto dividem o espaço livre); aqui só este wrapper empurra. */}
        <div className="ml-auto flex items-center gap-2">
          <TurnStat stats={lastTurn} />
          <ContextMeter tokens={contextTokens} onNew={onNew} />
          {!isEmpty && session && !session.id.startsWith('new-') && onOpenFull && (
            <button
              onClick={() => { setFullLoaded(true); onOpenFull(session.id); }}
              disabled={fullLoaded}
              title={truncated && !fullLoaded
                ? 'Esta sessão é longa: só as mensagens mais recentes foram carregadas. Clique para carregar o histórico completo (inclui anteriores a um /compact).'
                : 'Recarrega todas as mensagens do arquivo, inclusive as anteriores a um /compact que somem do caminho ativo'}
              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] transition disabled:opacity-50 ${
                truncated && !fullLoaded
                  ? 'border-amber-700/60 bg-amber-500/10 text-amber-300 hover:border-amber-600 hover:text-amber-200'
                  : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
              }`}
            >
              <Icon name="message" size={11} />
              {fullLoaded ? 'histórico completo' : truncated ? 'carregar antigas' : 'ver tudo'}
            </button>
          )}
          {!isEmpty && <ExportMenu title={session?.title || 'sessao'} messages={messages} />}
          {onTerminal && (
            <button
              onClick={onTerminal}
              title="Abrir terminais"
              className="relative flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition hover:border-neutral-700 hover:text-orange-300"
            >
              <Icon name="terminal" size={14} />
              {terminalRunning && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
              )}
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="print-thread scroll-thin flex-1 overflow-y-auto">
        {isEmpty && phase === 'idle' ? (
          <ChatEmpty onPrompt={onPrompt} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
            {messages.map((m, i) => (
              <MessageRow key={m.id} msg={m} caretOnLast={streaming && i === messages.length - 1 && m.role === 'assistant'} modelLabel={m.role === 'assistant' && m.model ? labelFor(m.model) : modelLabel} onEditUser={onEditUser} onQuote={onQuote} />
            ))}
            {phase === 'thinking' && <Thinking />}
          </div>
        )}
      </div>

      {!atBottom && !isEmpty && (
        <button
          onClick={scrollToBottom}
          title="Ir para o fim"
          className="fade-up absolute bottom-[84px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 shadow-lg shadow-black/40 transition hover:bg-neutral-700 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <Icon name="chevronDown" size={16} />
        </button>
      )}

      {failed && (
        <div className="flex shrink-0 items-center gap-2 border-t border-red-500/30 bg-red-500/[0.06] px-4 py-2">
          <Icon name="rotate" size={13} className="text-red-400" />
          <span className="text-[12px] text-red-200/90">O turno falhou. Reenviar a última mensagem?</span>
          <button
            onClick={retryLast}
            className="ml-auto rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-medium text-red-200 transition hover:bg-red-500/20"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {phase === 'idle' && lastEnd && !planPending && !failed && (
        <div className="flex shrink-0 items-center gap-2 border-t border-amber-500/30 bg-amber-500/[0.06] px-4 py-2">
          <Icon name="rotate" size={13} className="text-amber-400" />
          <span className="text-[12px] text-amber-200/90">
            {lastEnd.includes('budget') ? 'Interrompido pelo teto de gasto.' : 'Interrompido pelo limite de turnos.'} Retomar de onde parou?
          </span>
          <button
            onClick={() => onSend('Continue de onde você parou e termine a tarefa.')}
            className="ml-auto rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-200 transition hover:bg-amber-500/20"
          >
            Continuar
          </button>
        </div>
      )}

      {planPending && (
        <div className="flex shrink-0 items-center gap-2 border-t border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2">
          <Icon name="check" size={13} className="text-emerald-400" />
          <span className="text-[12px] text-emerald-200/90">Plano pronto para execução.</span>
          <button
            onClick={() => onSend('Plano aprovado — prossiga com a implementação.', 'acceptEdits')}
            className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Aprovar &amp; executar
          </button>
        </div>
      )}

      <ChatInput disabled={disabled} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode}
        caps={caps} bypass={bypass} setBypass={setBypass}
        model={model} setModel={setModel} models={models} budget={budget} setBudget={setBudget} slashCommands={slashCommands}
        attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} focusSignal={focusSignal}
        queued={queued} onQueue={setQueued} onCancelQueue={() => setQueued('')} history={sentHistory} pendingConfirm={bannerConfirm} onNew={onNew} onShowHelp={onShowHelp} />
    </div>
  );
}
