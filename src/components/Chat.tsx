import { useEffect, useMemo } from 'react';
import { isAgentModel } from '../../shared/agents';
import { Icon } from './primitives';
import { subscribeRefine } from './primitives/livepreview/refine-bus';
import { MessageRow } from './chat/MessageView';
import { LiveLine } from './chat/LiveLine';
import { ChatEmpty, ChatInput } from './chat/ChatInput';
import { ChatHeader } from './chat/ChatHeader';
import { CallDock } from './chat/call/CallDock';
import { ScrollAffordances } from './chat/ScrollAffordances';
import { ChatTopics } from './chat/ChatTopics';
import { useChatTopics } from './chat/useChatTopics';
import { useShownMessages } from './chat/useShownMessages';
import { interleaveByTime } from './chat/interleave';
import type { ShownMessage } from './chat/shown';
import { useCompacting } from './chat/useCompacting';
import { TurnBanners } from './chat/TurnBanners';
import { OrchestratorSessionBanner } from './chat/OrchestratorSessionBanner';
import { isOrchestratorSession } from './chat/orchestrator-banner';
import { SaturationBanner } from './chat/SaturationBanner';
import { SendCostNotice } from './chat/SendCostNotice';
import { useChatPanel, type Phase } from './chat/useChatPanel';
import { useFileDrop } from './chat/useFileDrop';
import { useTurnBit } from './chat/useTurnBit';
import { BackgroundAgents } from './chat/BackgroundAgents';
import { AttachmentModal } from './chat/AttachmentModal';
import type { ChatPanelProps } from './chat/chat-panel-props';
import { BotThreadContext, BOT_ANSWER_PLACEHOLDER } from './chat/bot-thread-context';

export type { Phase };

export function ChatPanel({ session, messages, phase, terminalBusy = false, draft, setDraft, onSend, onPrompt, onApproveWorkflow, onStop, mode, setMode, caps, claudeReady = true, bypass, setBypass, model, setModel, modelLocked, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, slashCommands, contextTokens, contextModel = null, sendCost, liveTurnTokens, turnStartedAt, bgAgents, lastTurn, lastEnd, onNew, onHandoff, handoffBusy = false, attachments, onUpload, onRemoveAttachment, attPreview = null, onAttOpen, onAttClose, attThumbs, onAttThumb, onEditUser, onQuote, onMemorize, onRename, onDelete, onOpenFull, onLoadOlder, onOpenSummary, truncated, onShowHelp, focusSignal = 0, onTerminal, terminalRunning, terminalOpen, usage, isMobile = false, onMenu, keyboardOpen = false, quotaPaused = false, quotaResetsAt = null, queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queuePaused, queueReleaseAt = 0, queueSetPaused, queueRetry, queueRunBg, queueRunNow, queueForce, resumeOffer = null, resumeRun, orchestratorSessionId, turnStatus, teamSlot, footer, restoring = false, botDecor, conn, call }: ChatPanelProps) {
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
  const compactingSince = useCompacting(messages, running, contextTokens, quotaPaused, contextModel);
  const turnBit = useTurnBit({ conn, phase, messages, waiting: c.pendingQuestion || c.planPending, failed: c.failed, quotaPaused });
  const live = running ? { tokens: liveTurnTokens ?? 0, startedAt: turnStartedAt, compactingSince: compactingSince ?? undefined } : undefined;
  // Drop em qualquer lugar do chat (não só no composer); o teto de tamanho é
  // checado no onUpload, que avisa em vez de descartar calado. O composer tem seu
  // próprio drop com stopPropagation, então soltar lá não dispara este também.
  const panelDnd = useFileDrop((files) => { for (const f of files) onUpload(f); return files.length; });
  const allShown = useShownMessages(messages);
  const shown = useMemo(() => (botDecor ? allShown.filter((m) => !botDecor.hideMessage(m)) : allShown), [allShown, botDecor]);
  const rows = useMemo(() => interleaveByTime(shown, botDecor?.extras ?? []), [shown, botDecor]);
  const lastUserIdx = shown.findLastIndex((m) => m.role === 'user');
  const topics = useChatTopics(c.scrollRef, messages);

  const renderRow = (m: ShownMessage, i: number) => (
    <MessageRow key={m.id} msg={m} caretOnLast={c.streaming && i === shown.length - 1 && m.role === 'assistant'} modelLabel={botDecor ? botDecor.name : m.role === 'assistant' && m.model ? c.labelFor(m.model) : c.modelLabel} avatar={botDecor?.avatar} bit={i === shown.length - 1 && m.role === 'assistant' ? turnBit : undefined} showModelLabel={!!botDecor} thinking={phase !== 'idle' && !c.pendingQuestion && i === shown.length - 1 && m.role === 'assistant'} live={i === shown.length - 1 && m.role === 'assistant' && !c.pendingQuestion ? live : undefined} onEditUser={onEditUser} onQuote={onQuote} onMemorize={onMemorize} answerable={(phase === 'idle' || c.pendingQuestion) && i === shown.length - 1 && m.role === 'assistant'} onAnswer={onPrompt} reviewable={phase === 'idle' && i > lastUserIdx && m.role === 'assistant'} onApproveWorkflow={onApproveWorkflow} onRegenerate={phase === 'idle' && !c.pendingQuestion && i === shown.length - 1 && m.role === 'assistant' ? c.retryLast : undefined} onOpenAttachment={onAttOpen} attThumbs={attThumbs} onAttThumb={onAttThumb} />
  );

  const composer = (
    <ChatInput disabled={c.disabled} placeholder={botDecor && c.pendingQuestion ? BOT_ANSWER_PLACEHOLDER : undefined} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode}
      caps={caps} bypass={bypass} setBypass={setBypass}
      model={model} setModel={setModel} modelLocked={modelLocked} models={models} onRefreshModels={onRefreshModels}
      effort={effort} setEffort={setEffort}
      mcpServers={mcpServers} selectedMcps={selectedMcps} setSelectedMcps={setSelectedMcps} slashCommands={slashCommands}
      attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} onOpenAttachment={onAttOpen} attThumbs={attThumbs} onAttThumb={onAttThumb} focusSignal={focusSignal}
      queued={c.queued} queuedAtts={c.queuedAtts} queuedModels={c.queuedModels} onRunQueuedBg={c.runQueuedInBgAt} onRunQueuedNow={c.runQueuedNowAt} onQueue={c.enqueue} onCancelQueueAt={c.cancelQueueAt} onEditQueuedAt={c.editQueuedAt} onMoveQueued={c.moveQueuedItem} history={c.sentHistory} pendingConfirm={c.bannerConfirm} onNew={onNew} onShowHelp={onShowHelp}
      queuePaused={queuePaused} queueReleaseAt={queueReleaseAt} onToggleQueuePause={() => queueSetPaused(!queuePaused)}
      queueHeld={c.queueHeld} onResumeQueue={c.resumeQueue}
      paused={quotaPaused} quotaResetsAt={quotaResetsAt} onCall={call.supported ? call.dial : undefined} />
  );
  const hero = c.isEmpty && phase === 'idle' && !botDecor && !restoring;

  return (
    <div
      className="relative flex h-full flex-col bg-neutral-900"
      onDragEnter={panelDnd.onDragEnter} onDragOver={panelDnd.onDragOver}
      onDragLeave={panelDnd.onDragLeave} onDrop={panelDnd.onDrop}
    >
      {panelDnd.dragging && (
        <div className="pointer-events-none absolute inset-2 z-50 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-500/60 bg-neutral-950/85 text-[14px] font-medium text-orange-300 backdrop-blur-xs">
          <Icon name="paperclip" size={22} /> Solte os arquivos pra anexar
        </div>
      )}
      <ChatHeader
        session={session} messages={messages} isEmpty={c.isEmpty} isMobile={isMobile}
        contextTokens={contextTokens} contextModel={contextModel} lastTurn={lastTurn} onNew={onNew}
        fullLoaded={c.fullLoaded} truncated={truncated} onOpenFull={onOpenFull} onLoadOlder={onLoadOlder} onOpenSummary={onOpenSummary}
        beforeGrow={c.captureAnchor}
        setFullLoaded={c.setFullLoaded} onTerminal={onTerminal} terminalRunning={terminalRunning} terminalOpen={terminalOpen} usage={usage} onRename={onRename} onDelete={onDelete}
        keyboardOpen={keyboardOpen} selectedModel={model} onMenu={isMobile ? onMenu : undefined} teamSlot={teamSlot} restoring={restoring}
        agent={botDecor && { name: botDecor.name, avatar: botDecor.avatar, ...botDecor.header }}
      />

      {isOrchestratorSession(session?.id, orchestratorSessionId) && <OrchestratorSessionBanner />}

      {/* Wrapper relativo: as afordâncias de scroll ancoram no fim da ÁREA DE
          SCROLL, não do painel — antes (bottom fixo no painel) um composer alto
          engolia os botões pra dentro do input. */}
      {hero ? <ChatEmpty onPrompt={onPrompt} onSeed={setDraft} needsProvider={!claudeReady && !isAgentModel(model)}>{composer}</ChatEmpty> : (
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={c.scrollRef} onScroll={c.onScroll} className="print-thread scroll-thin flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3">
        {c.isEmpty && phase === 'idle' && !botDecor?.extras.length ? (
          botDecor?.empty
        ) : (
          // role=log is polite-live: a reader hears new replies. aria-busy holds it
          // while tokens stream, so it reads the finished answer, not every delta.
          <div role="log" aria-label="Conversa" aria-busy={c.streaming} className={`mx-auto flex w-full min-w-0 max-w-[760px] flex-col gap-6 pb-10 pt-8 ${topics.topics.length > 0 ? 'pr-6' : ''}`}>
            <BotThreadContext.Provider value={!!botDecor}>
              {rows.map((r) => (r.kind === 'extra' ? <div key={r.key}>{r.node}</div> : renderRow(r.msg, r.index)))}
            </BotThreadContext.Provider>
            {/* Sem bolha de assistente na cauda (ex: divisor recém-inserido) o turno
                em voo ficaria sem nenhum sinal — vale pra streaming também. */}
            {!c.pendingQuestion && (phase !== 'idle' && shown[shown.length - 1]?.role !== 'assistant' || phase === 'idle' && terminalBusy) && <div className="fade-up"><LiveLine live={live} bit={phase === 'idle' ? 'working' : turnBit} avatar={botDecor?.avatar} /></div>}
          </div>
        )}
      </div>

      {!c.isEmpty && <ChatTopics topics={topics.topics} activeId={topics.activeId} open={topics.open} setOpen={topics.setOpen} onJump={topics.jumpTo} />}

      {!c.isEmpty && !c.atBottom && (
        <ScrollAffordances promptAbove={c.promptAbove} onScrollToPrompt={c.scrollToLastPrompt} onScrollToBottom={c.scrollToBottom} />
      )}
      </div>
      )}

      {/* Com o teclado aberto o thread inteiro cabe em ~150px: faixa de agentes
          e aviso de saturação saem de cena até fechar. */}
      {!keyboardOpen && <BackgroundAgents agents={bgAgents} />}

      {!keyboardOpen && phase === 'idle' && onHandoff && (
        <SaturationBanner sessionId={session?.id} contextTokens={contextTokens} contextModel={contextModel} busy={handoffBusy} onHandoff={onHandoff} />
      )}

      {/* Preço do próximo envio. Fica em repouso e com o teclado fechado, junto do
          banner de saturação: os dois respondem perguntas diferentes (a sessão está
          cheia? / quanto custa mandar agora?) e só juntos explicam o gasto. */}
      {!keyboardOpen && phase === 'idle' && <SendCostNotice cost={sendCost ?? null} />}

      {turnStatus}

      <TurnBanners phase={phase} failed={c.failed} resumeOffer={resumeOffer} onResume={resumeOffer && resumeRun ? () => resumeRun(resumeOffer.sessionKey) : undefined} planPending={c.planPending} pendingQuestion={c.pendingQuestion} queuedCount={c.queued.length} lastEnd={lastEnd} retryLast={c.retryLast} retryText={c.retryText} onSend={onSend} onForceQueue={session ? () => queueForce(session.id) : undefined} />

      <CallDock call={call} />

      {!hero && composer}

      {!keyboardOpen && footer}

      {attPreview && onAttClose && <AttachmentModal att={attPreview} onClose={onAttClose} />}
    </div>
  );
}
