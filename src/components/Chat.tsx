import { Icon } from './primitives';
import { MessageRow, Thinking } from './chat/MessageView';
import { ChatEmpty, ChatInput } from './chat/ChatInput';
import { ChatHeader } from './chat/ChatHeader';
import { TurnBanners } from './chat/TurnBanners';
import { ClaudeAuthBanner } from './chat/ClaudeAuthBanner';
import { useChatPanel, type Phase } from './chat/useChatPanel';
import type { Session, Message } from '../data/mock';
import type { PermMode, ModelInfo, TurnStats, Caps, SkillMeta } from '../../shared/protocol';
import type { Attachment } from '../useCockpit';

export type { Phase };

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
  claudeReady?: boolean;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  slashCommands: string[];
  contextTokens: number;
  liveTurnTokens?: number;
  turnStartedAt?: number;
  lastTurn?: TurnStats;
  onNew: () => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onEditUser?: (text: string) => void;
  onQuote?: (text: string) => void;
  onOpenFull?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  truncated?: boolean;
  onShowHelp?: () => void;
  lastEnd?: string;
  focusSignal?: number;
  onTerminal?: () => void;
  terminalRunning?: boolean;
  isMobile?: boolean;
}

export function ChatPanel({ session, messages, phase, draft, setDraft, onSend, onPrompt, onStop, mode, setMode, caps, claudeReady = true, bypass, setBypass, model, setModel, models, skills, selectedSkills, setSelectedSkills, slashCommands, contextTokens, liveTurnTokens, turnStartedAt, lastTurn, lastEnd, onNew, attachments, onUpload, onRemoveAttachment, onEditUser, onQuote, onOpenFull, onOpenSummary, truncated, onShowHelp, focusSignal = 0, onTerminal, terminalRunning, isMobile = false }: ChatPanelProps) {
  const c = useChatPanel({ session, messages, phase, models, model, lastEnd, onSend });
  // Stats AO VIVO do turno (estilo terminal): tokens gastos + tempo decorrido,
  // enquanto o turno roda. Some no `done` (phase volta a idle).
  const live = phase === 'thinking' || phase === 'streaming' ? { tokens: liveTurnTokens ?? 0, startedAt: turnStartedAt } : undefined;

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <ChatHeader
        session={session} messages={messages} isEmpty={c.isEmpty} isMobile={isMobile}
        contextTokens={contextTokens} lastTurn={lastTurn} onNew={onNew}
        fullLoaded={c.fullLoaded} truncated={truncated} onOpenFull={onOpenFull} onOpenSummary={onOpenSummary}
        setFullLoaded={c.setFullLoaded} onTerminal={onTerminal} terminalRunning={terminalRunning}
      />

      {!claudeReady && <ClaudeAuthBanner onTerminal={onTerminal} />}

      <div ref={c.scrollRef} onScroll={c.onScroll} className="print-thread scroll-thin flex-1 overflow-y-auto">
        {c.isEmpty && phase === 'idle' ? (
          <ChatEmpty onPrompt={onPrompt} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
            {messages.map((m, i) => (
              <MessageRow key={m.id} msg={m} caretOnLast={c.streaming && i === messages.length - 1 && m.role === 'assistant'} modelLabel={m.role === 'assistant' && m.model ? c.labelFor(m.model) : c.modelLabel} thinking={phase !== 'idle' && i === messages.length - 1 && m.role === 'assistant'} live={i === messages.length - 1 && m.role === 'assistant' ? live : undefined} onEditUser={onEditUser} onQuote={onQuote} answerable={phase === 'idle' && i === messages.length - 1 && m.role === 'assistant'} onAnswer={onPrompt} />

            ))}
            {phase === 'thinking' && messages[messages.length - 1]?.role !== 'assistant' && <Thinking live={live} />}
          </div>
        )}
      </div>

      {!c.atBottom && !c.isEmpty && (
        <button
          onClick={c.scrollToBottom}
          title="Ir para o fim"
          className="fade-up absolute bottom-[84px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 shadow-lg shadow-black/40 transition hover:bg-neutral-700 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <Icon name="chevronDown" size={16} />
        </button>
      )}

      <TurnBanners phase={phase} failed={c.failed} planPending={c.planPending} lastEnd={lastEnd} retryLast={c.retryLast} onSend={onSend} />

      <ChatInput disabled={c.disabled} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode}
        caps={caps} bypass={bypass} setBypass={setBypass}
        model={model} setModel={setModel} models={models}
        skills={skills} selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills} slashCommands={slashCommands}
        attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} focusSignal={focusSignal}
        queued={c.queued} onQueue={c.enqueue} onCancelQueueAt={c.cancelQueueAt} history={c.sentHistory} pendingConfirm={c.bannerConfirm} onNew={onNew} onShowHelp={onShowHelp} />
    </div>
  );
}
