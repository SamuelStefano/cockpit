import { useEffect, useMemo } from 'react';
import { Icon } from './primitives';
import { subscribeRefine } from './primitives/livepreview/refine-bus';
import { MessageRow, Thinking } from './chat/MessageView';
import { ChatEmpty, ChatInput } from './chat/ChatInput';
import { ChatHeader } from './chat/ChatHeader';
import { ScrollAffordances } from './chat/ScrollAffordances';
import { TaskTray } from './chat/TaskTray';
import { latestTodos } from './chat/task-tray';
import { useShownMessages } from './chat/useShownMessages';
import { useCompacting } from './chat/useCompacting';
import { TurnBanners } from './chat/TurnBanners';
import { FollowupChips } from './chat/FollowupChips';
import { ClaudeAuthBanner } from './chat/ClaudeAuthBanner';
import { SaturationBanner } from './chat/SaturationBanner';
import { useChatPanel, type Phase } from './chat/useChatPanel';
import { useFileDrop } from './chat/useFileDrop';
import { BackgroundAgents } from './chat/BackgroundAgents';
import { AttachmentModal } from './chat/AttachmentModal';
import type { ChatPanelProps } from './chat/chat-panel-props';

export type { Phase };

export function ChatPanel({ session, messages, phase, terminalBusy = false, sessionTodos, followups, onDismissFollowups, draft, setDraft, onSend, onPrompt, onStop, mode, setMode, caps, claudeReady = true, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, slashCommands, contextTokens, liveTurnTokens, turnStartedAt, bgAgents, lastTurn, lastEnd, onNew, onHandoff, handoffBusy = false, attachments, onUpload, onRemoveAttachment, attPreview = null, onAttOpen, onAttClose, attThumbs, onAttThumb, onEditUser, onQuote, onRename, onOpenFull, onLoadOlder, onOpenSummary, truncated, onShowHelp, focusSignal = 0, onTerminal, terminalRunning, isMobile = false, quotaPaused = false, quotaResetsAt = null, queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queuePaused, queueSetPaused, queueRetry, queueRunBg, queueRunNow, queueForce }: ChatPanelProps) {
  const c = useChatPanel({ session, messages, phase, models, model, lastEnd, onSend, queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queueRetry, queueRunBg, queueRunNow });
  // Modo iterativo: um refino pedido de dentro de um live preview vira o próximo
  // prompt (o card não tem acesso ao compositor — publica no [[refine-bus]]).
  useEffect(() => subscribeRefine((text) => onPrompt(`Refina a última tela/preview: ${text}`)), [onPrompt]);
  // Stats AO VIVO do turno (estilo terminal): tokens gastos + tempo decorrido,
  // enquanto o turno roda. Some no `done` (phase volta a idle).
  const running = phase === 'thinking' || phase === 'streaming';
  // Compactação não emite frame nenhum (o CLI só avisa depois): o silêncio longo
  // com o contexto cheio é o que denuncia, e vira indicador ao vivo no lugar do
  // "Pensando…" — antes o chat parecia travado por minutos.
  const compactingSince = useCompacting(messages, running, contextTokens, quotaPaused);
  const live = running ? { tokens: liveTurnTokens ?? 0, startedAt: turnStartedAt, compactingSince: compactingSince ?? undefined } : undefined;
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
  const shown = useShownMessages(messages);

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
        fullLoaded={c.fullLoaded} truncated={truncated} onOpenFull={onOpenFull} onLoadOlder={onLoadOlder} onOpenSummary={onOpenSummary}
        beforeGrow={c.captureAnchor}
        setFullLoaded={c.setFullLoaded} onTerminal={onTerminal} terminalRunning={terminalRunning} onRename={onRename}
      />

      {!claudeReady && <ClaudeAuthBanner onTerminal={onTerminal} />}

      {/* Wrapper relativo: as afordâncias de scroll ancoram no fim da ÁREA DE
          SCROLL, não do painel — antes (bottom fixo no painel) um composer alto
          engolia os botões pra dentro do input. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={c.scrollRef} onScroll={c.onScroll} className="print-thread scroll-thin flex-1 overflow-y-auto overflow-x-hidden">
        {c.isEmpty && phase === 'idle' ? (
          <ChatEmpty onPrompt={onPrompt} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {shown.map((m, i) => (
              <MessageRow key={m.id} msg={m} caretOnLast={c.streaming && i === shown.length - 1 && m.role === 'assistant'} modelLabel={m.role === 'assistant' && m.model ? c.labelFor(m.model) : c.modelLabel} showModelLabel thinking={phase !== 'idle' && !c.pendingQuestion && i === shown.length - 1 && m.role === 'assistant'} live={i === shown.length - 1 && m.role === 'assistant' && !c.pendingQuestion ? live : undefined} onEditUser={onEditUser} onQuote={onQuote} answerable={(phase === 'idle' || c.pendingQuestion) && i === shown.length - 1 && m.role === 'assistant'} onAnswer={onPrompt} onRegenerate={phase === 'idle' && !c.pendingQuestion && i === shown.length - 1 && m.role === 'assistant' ? c.retryLast : undefined} onOpenAttachment={onAttOpen} attThumbs={attThumbs} onAttThumb={onAttThumb} />

            ))}
            {/* Sem bolha de assistente na cauda (ex: divisor recém-inserido) o turno
                em voo ficaria sem nenhum sinal — vale pra streaming também. */}
            {!c.pendingQuestion && (phase !== 'idle' && shown[shown.length - 1]?.role !== 'assistant' || phase === 'idle' && terminalBusy) && <Thinking live={live} />}
          </div>
        )}
      </div>

      {!c.isEmpty && !c.atBottom && (
        <ScrollAffordances promptAbove={c.promptAbove} onScrollToPrompt={c.scrollToLastPrompt} onScrollToBottom={c.scrollToBottom} />
      )}
      </div>

      {trayTodos && <TaskTray todos={trayTodos} />}

      <BackgroundAgents agents={bgAgents} />

      {/* Chips só em repouso de verdade: sem turno, sem pergunta/plano pendente e
          sem fila — nesses estados o banner correspondente é a ação principal. */}
      {phase === 'idle' && !c.isEmpty && !c.pendingQuestion && !c.planPending && !c.failed && c.queued.length === 0 && followups && onDismissFollowups && (
        <FollowupChips items={followups} onPick={onPrompt} onDismiss={onDismissFollowups} />
      )}

      {phase === 'idle' && onHandoff && (
        <SaturationBanner sessionId={session?.id} contextTokens={contextTokens} busy={handoffBusy} onHandoff={onHandoff} />
      )}

      <TurnBanners phase={phase} failed={c.failed} planPending={c.planPending} pendingQuestion={c.pendingQuestion} queuedCount={c.queued.length} lastEnd={lastEnd} retryLast={c.retryLast} onSend={onSend} onForceQueue={session ? () => queueForce(session.id) : undefined} />

      <ChatInput disabled={c.disabled} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode}
        caps={caps} bypass={bypass} setBypass={setBypass}
        model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels}
        effort={effort} setEffort={setEffort}
        skills={skills} selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills} mcpServers={mcpServers} selectedMcps={selectedMcps} setSelectedMcps={setSelectedMcps} slashCommands={slashCommands}
        attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} focusSignal={focusSignal}
        queued={c.queued} queuedAtts={c.queuedAtts} queuedModels={c.queuedModels} onRunQueuedBg={c.runQueuedInBgAt} onRunQueuedNow={c.runQueuedNowAt} onQueue={c.enqueue} onCancelQueueAt={c.cancelQueueAt} onEditQueuedAt={c.editQueuedAt} onMoveQueued={c.moveQueuedItem} history={c.sentHistory} pendingConfirm={c.bannerConfirm} onNew={onNew} onShowHelp={onShowHelp}
        queuePaused={queuePaused} onToggleQueuePause={() => queueSetPaused(!queuePaused)}
        queueHeld={c.queueHeld} onResumeQueue={c.resumeQueue}
        paused={quotaPaused} quotaResetsAt={quotaResetsAt} />

      {attPreview && onAttClose && <AttachmentModal att={attPreview} onClose={onAttClose} />}
    </div>
  );
}
