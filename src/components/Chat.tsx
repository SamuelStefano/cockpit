import { useMemo } from 'react';
import { Icon } from './primitives';
import { MessageRow, Thinking } from './chat/MessageView';
import { ChatEmpty, ChatInput } from './chat/ChatInput';
import { ChatHeader } from './chat/ChatHeader';
import { TaskTray } from './chat/TaskTray';
import { latestTodos } from './chat/task-tray';
import { clampToPendingQuestion } from '../cockpit/pending-question';
import { TurnBanners } from './chat/TurnBanners';
import { FollowupChips } from './chat/FollowupChips';
import { ClaudeAuthBanner } from './chat/ClaudeAuthBanner';
import { useChatPanel, type Phase } from './chat/useChatPanel';
import { useFileDrop } from './chat/useFileDrop';
import type { Session, Message, ToolTodo } from '../data/mock';
import type { PermMode, Effort, ModelInfo, TurnStats, Caps, SkillMeta } from '../../shared/protocol';
import type { Attachment, AttachmentPreview } from '../useCockpit';
import { AttachmentModal } from './chat/AttachmentModal';

export type { Phase };

export interface ChatPanelProps {
  session: Session | null;
  messages: Message[];
  phase: Phase;
  // Escrita externa (turno do terminal) na sessão ativa há <5s — acende a
  // estrelinha mesmo sem run do app (paridade com acompanhar pelo terminal).
  terminalBusy?: boolean;
  // Estado corrente da lista de tarefas (arquivo inteiro, via frame history) —
  // fallback do tray quando a janela visível não tem snapshot (pós-compact).
  sessionTodos?: ToolTodo[];
  // Tópicos de continuação pós-turno (chips estilo ChatGPT) + dispensa.
  followups?: string[];
  onDismissFollowups?: () => void;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onPrompt: (text: string) => void;
  onStop: () => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  claudeReady?: boolean;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  effort: Effort;
  setEffort: (e: Effort) => void;
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  slashCommands: string[];
  contextTokens: number;
  liveTurnTokens?: number;
  turnStartedAt?: number;
  lastTurn?: TurnStats;
  onNew: () => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  attPreview?: AttachmentPreview | null;
  onAttOpen?: (path: string, name: string) => void;
  onAttClose?: () => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
  onEditUser?: (id: string, text: string) => void;
  onQuote?: (text: string) => void;
  onRename?: (id: string, title: string) => void;
  onOpenFull?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  truncated?: boolean;
  onShowHelp?: () => void;
  lastEnd?: string;
  focusSignal?: number;
  onTerminal?: () => void;
  terminalRunning?: boolean;
  isMobile?: boolean;
  quotaPaused?: boolean;
  quotaResetsAt?: number | null;
}

export function ChatPanel({ session, messages, phase, terminalBusy = false, sessionTodos, followups, onDismissFollowups, draft, setDraft, onSend, onPrompt, onStop, mode, setMode, caps, claudeReady = true, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, slashCommands, contextTokens, liveTurnTokens, turnStartedAt, lastTurn, lastEnd, onNew, attachments, onUpload, onRemoveAttachment, attPreview = null, onAttOpen, onAttClose, attThumbs, onAttThumb, onEditUser, onQuote, onRename, onOpenFull, onOpenSummary, truncated, onShowHelp, focusSignal = 0, onTerminal, terminalRunning, isMobile = false, quotaPaused = false, quotaResetsAt = null }: ChatPanelProps) {
  const c = useChatPanel({ session, messages, phase, models, model, lastEnd, onSend, paused: quotaPaused });
  // Stats AO VIVO do turno (estilo terminal): tokens gastos + tempo decorrido,
  // enquanto o turno roda. Some no `done` (phase volta a idle).
  const live = phase === 'thinking' || phase === 'streaming' ? { tokens: liveTurnTokens ?? 0, startedAt: turnStartedAt } : undefined;
  // Drop em qualquer lugar do chat (não só no composer): teto de 15MB espelha o
  // backend. O composer tem seu próprio drop com stopPropagation, então soltar lá
  // não dispara este também.
  const panelDnd = useFileDrop((files) => { let n = 0; for (const f of files) { if (f.size > 15_000_000) continue; onUpload(f); n++; } return n; });
  // Derivado memoizado: messages troca de referência a cada token streamado e a
  // varredura reversa só deve rodar quando a lista realmente muda.
  // Precedência do tray: com turno RODANDO os snapshots ao vivo (carimbados nos
  // tool frames) são os mais novos; ocioso, o estado do arquivo inteiro (frame
  // history) vence — um snapshot velho visível na chain não desatualiza o tray.
  const trayTodos = useMemo(
    () => (phase !== 'idle' ? latestTodos(messages) ?? sessionTodos : sessionTodos ?? latestTodos(messages)),
    [messages, sessionTodos, phase],
  );
  // Trava a exibição numa pergunta pendente do agente: o `claude -p` auto-resolve
  // o AskUserQuestion e continua gerando — sem isto o card aparecia e "sumia"
  // (enterrado pela continuação). Garante que a pergunta fica como última msg e
  // respondível, independente da versão do backend (defesa no front).
  const shown = useMemo(() => clampToPendingQuestion(messages), [messages]);

  return (
    <div
      className="relative flex h-full flex-col bg-neutral-900"
      onDragEnter={panelDnd.onDragEnter} onDragOver={panelDnd.onDragOver}
      onDragLeave={panelDnd.onDragLeave} onDrop={panelDnd.onDrop}
    >
      {panelDnd.dragging && (
        <div className="pointer-events-none absolute inset-2 z-50 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-500/60 bg-neutral-950/85 text-[14px] font-medium text-orange-300 backdrop-blur-sm">
          <Icon name="paperclip" size={22} /> Solte os arquivos pra anexar
        </div>
      )}
      <ChatHeader
        session={session} messages={messages} isEmpty={c.isEmpty} isMobile={isMobile}
        contextTokens={contextTokens} lastTurn={lastTurn} onNew={onNew}
        fullLoaded={c.fullLoaded} truncated={truncated} onOpenFull={onOpenFull} onOpenSummary={onOpenSummary}
        setFullLoaded={c.setFullLoaded} onTerminal={onTerminal} terminalRunning={terminalRunning} onRename={onRename}
      />

      {!claudeReady && <ClaudeAuthBanner onTerminal={onTerminal} />}

      <div ref={c.scrollRef} onScroll={c.onScroll} className="print-thread scroll-thin flex-1 overflow-y-auto">
        {c.isEmpty && phase === 'idle' ? (
          <ChatEmpty onPrompt={onPrompt} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {shown.map((m, i) => (
              <MessageRow key={m.id} msg={m} caretOnLast={c.streaming && i === shown.length - 1 && m.role === 'assistant'} modelLabel={m.role === 'assistant' && m.model ? c.labelFor(m.model) : c.modelLabel} showModelLabel thinking={phase !== 'idle' && i === shown.length - 1 && m.role === 'assistant'} live={i === shown.length - 1 && m.role === 'assistant' ? live : undefined} onEditUser={onEditUser} onQuote={onQuote} answerable={phase === 'idle' && i === shown.length - 1 && m.role === 'assistant'} onAnswer={onPrompt} onRegenerate={phase === 'idle' && i === shown.length - 1 && m.role === 'assistant' ? c.retryLast : undefined} onOpenAttachment={onAttOpen} attThumbs={attThumbs} onAttThumb={onAttThumb} />

            ))}
            {(phase === 'thinking' && shown[shown.length - 1]?.role !== 'assistant' || phase === 'idle' && terminalBusy) && <Thinking live={live} />}
          </div>
        )}
      </div>

      {!c.isEmpty && !c.atBottom && (
        <div className="fade-up absolute bottom-[84px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          {c.promptAbove && (
            <button
              onClick={c.scrollToLastPrompt}
              title="Voltar ao meu prompt"
              className="flex h-7 items-center gap-1 rounded-full border border-neutral-800/70 bg-neutral-900/60 px-2.5 text-[11px] font-medium text-neutral-500 opacity-60 backdrop-blur-sm transition hover:border-orange-500/30 hover:text-orange-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            >
              <Icon name="arrowUp" size={11} /> meu prompt
            </button>
          )}
          {!c.atBottom && (
            <button
              onClick={c.scrollToBottom}
              title="Ir para o fim"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 shadow-lg shadow-black/40 transition hover:bg-neutral-700 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            >
              <Icon name="chevronDown" size={16} />
            </button>
          )}
        </div>
      )}

      {trayTodos && <TaskTray todos={trayTodos} />}

      {/* Chips só em repouso de verdade: sem turno, sem pergunta/plano pendente e
          sem fila — nesses estados o banner correspondente é a ação principal. */}
      {phase === 'idle' && !c.isEmpty && !c.pendingQuestion && !c.planPending && !c.failed && c.queued.length === 0 && followups && onDismissFollowups && (
        <FollowupChips items={followups} onPick={onPrompt} onDismiss={onDismissFollowups} />
      )}

      <TurnBanners phase={phase} failed={c.failed} planPending={c.planPending} pendingQuestion={c.pendingQuestion} queuedCount={c.queued.length} lastEnd={lastEnd} retryLast={c.retryLast} onSend={onSend} />

      <ChatInput disabled={c.disabled} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode}
        caps={caps} bypass={bypass} setBypass={setBypass}
        model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels}
        effort={effort} setEffort={setEffort}
        skills={skills} selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills} mcpServers={mcpServers} selectedMcps={selectedMcps} setSelectedMcps={setSelectedMcps} slashCommands={slashCommands}
        attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} focusSignal={focusSignal}
        queued={c.queued} onQueue={c.enqueue} onCancelQueueAt={c.cancelQueueAt} onMoveQueued={c.moveQueuedItem} history={c.sentHistory} pendingConfirm={c.bannerConfirm} onNew={onNew} onShowHelp={onShowHelp}
        paused={quotaPaused} quotaResetsAt={quotaResetsAt} />

      {attPreview && onAttClose && <AttachmentModal att={attPreview} onClose={onAttClose} />}
    </div>
  );
}
