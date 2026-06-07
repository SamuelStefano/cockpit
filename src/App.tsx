import { useState, useEffect, useRef, useMemo } from 'react';
import { MobileLayout } from './components/Mobile';
import { DesktopLayout } from './app/DesktopLayout';
import { StatusBar } from './components/StatusBar';
import { Header, QuotaBanner, OfflineNotice, AuthGate } from './components/AppChrome';
import { Contextos } from './routes/Contextos';
import { Skills } from './routes/Skills';
import { Observatorio } from './routes/Observatorio';
import { Admin } from './routes/Admin';
import { Docs } from './routes/Docs';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { useCockpit } from './useCockpit';
import { useRoute } from './useRoute';
import { setTitleBase } from './lib/notify';
import { relReset } from './lib/time';
import { usePanelResize } from './app/usePanelResize';
import { useTerminalTabs } from './app/useTerminalTabs';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';

// --- CockpitApp ------------------------------------------------------------

export function CockpitApp() {
  const cockpit = useCockpit();
  const {
    sessions, loading, activeId: activeSessionId, setActiveId: setActiveSessionId,
    messages, phase, running, stalled, updated, draft, setDraft, conn, authRequired, submitToken, rate, planUsage, stats, mode, setMode, caps, bypass, setBypass, model, setModel, models, budget, setBudget, slashCommands, term, discoveredTerms, listTerms,
    archived, onUnhide: handleUnhide, contextTokens, usage, lastTurn, lastEnd, searchResults, onSearch,
    contexts, openContext, onCtxList, onCtxOpen, onCtxClose,
    skills, openSkill, onSkillList, onSkillOpen, onSkillClose,
    usageStats, onUsageList, health, onHealthList,
    attachments, onUpload, onRemoveAttachment,
    onSend: handleSend, onStop: handleStop, onNew: cockpitNew, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession,
    onOpenFull,
  } = cockpit;

  const { route, nav } = useRoute();

  const { rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag } = usePanelResize();
  const { terminals, activeTermId, setActiveTermId, handleAddTerm, handleCloseTerm, attachable, attachExisting, runningTerm } = useTerminalTabs(term, discoveredTerms, listTerms);

  const [quotaClosed, setQuotaClosed] = useState(false);
  // Só alerta quando o próprio CLI sinaliza near-limit/limite (status !== 'allowed').
  // O CLI não envia % de uso; 'allowed' = longe do teto, então não pisca à toa.
  const quota = !!rate && rate.status !== 'allowed' && !quotaClosed;

  // Só alarma depois de ~6s offline (atravessa o flap reconnecting↔down sem piscar).
  const offlineSince = useRef<number | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  useEffect(() => {
    if (conn.ws === 'connected') { offlineSince.current = null; setShowOffline(false); return; }
    if (offlineSince.current == null) offlineSince.current = Date.now();
    const id = setTimeout(() => setShowOffline(true), Math.max(0, 6000 - (Date.now() - offlineSince.current)));
    return () => clearTimeout(id);
  }, [conn.ws]);

  const [isMobile, setIsMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [termSheet, setTermSheet] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  useGlobalShortcuts({ sessions, activeSessionId, setActiveSessionId, updated, nav, setPalette, setHelp });

  const editUser = (text: string) => { setDraft(text); setFocusSignal((n) => n + 1); };

  // Citar uma mensagem: vira blockquote no topo do rascunho atual (trunca longos).
  const quoteMsg = (text: string) => {
    const clipped = text.length > 280 ? text.slice(0, 280).trimEnd() + '…' : text;
    const quoted = clipped.split('\n').map((l) => '> ' + l).join('\n');
    setDraft((draft ? draft.trimEnd() + '\n\n' : '') + quoted + '\n\n');
    setFocusSignal((n) => n + 1);
  };

  // Custo estimado acumulado por sessão (do observatório) → chip no sidebar.
  const sessionCost = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of usageStats?.sessions ?? []) m[s.sessionId] = s.costUsd;
    return m;
  }, [usageStats]);

  useEffect(() => {
    if (!activeSessionId && sessions.length) setActiveSessionId(sessions[0].id);
  }, [activeSessionId, sessions, setActiveSessionId]);

  // Reflete atividade no título da aba (visível com a aba em background no run
  // noturno): "▶N" rodando, "●N" com output novo não visto.
  useEffect(() => {
    const parts: string[] = [];
    if (running.size) parts.push(`▶${running.size}`);
    if (updated.size) parts.push(`●${updated.size}`);
    setTitleBase((parts.length ? parts.join(' ') + ' — ' : '') + 'Deck');
  }, [running, updated]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const viewPhase = phase;

  const handleNew = () => {
    cockpitNew();
    setDrawer(false);
    nav('/');
  };

  const sessionsProps = { sessions, loading, activeId: activeSessionId, onSelect: setActiveSessionId, onNew: handleNew, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession, onStop: handleStop, archived, onUnhide: handleUnhide, usage, cost: sessionCost, running, stalled, updated, searchResults, onSearch };
  const chatProps = { session: activeSession, messages, phase: viewPhase, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop, mode, setMode, caps, bypass, setBypass, model, setModel, models, budget, setBudget, slashCommands, contextTokens, lastTurn, lastEnd, onNew: handleNew, attachments, onUpload, onRemoveAttachment, onEditUser: editUser, onQuote: quoteMsg, onOpenFull, onShowHelp: () => setHelp(true), focusSignal };
  const termProps = { terminals, activeId: activeTermId, onSelect: setActiveTermId, onAdd: handleAddTerm, onClose: handleCloseTerm, term, attachable, onAttach: attachExisting };

  // Gate de auth (DR-011 Fase 2): servidor exige token e o nosso falta/errou.
  // Substitui o app inteiro até autenticar — nada da VPS aparece antes disso.
  if (authRequired) {
    return (
      <div
        className="flex h-full flex-col bg-neutral-950"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <AuthGate onSubmit={submitToken} />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col bg-neutral-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <CommandPalette
        open={palette} onClose={() => setPalette(false)}
        route={route} nav={nav} onNew={handleNew}
        mode={mode} setMode={setMode}
        sessions={sessions} onSelectSession={setActiveSessionId}
        running={running} onStop={handleStop} onFocusComposer={() => setFocusSignal((n) => n + 1)}
        onShowHelp={() => setHelp(true)}
      />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <Header conn={conn} isMobile={isMobile} onMenu={() => setDrawer(true)} route={route} nav={nav} onPalette={() => setPalette(true)} planUsage={planUsage} onNew={handleNew} />

      {quota && rate && <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />}
      <OfflineNotice show={showOffline} />

      {route === '/contextos' ? (
        <Contextos connected={conn.ws === 'connected'} contexts={contexts} openContext={openContext}
          onCtxList={onCtxList} onCtxOpen={onCtxOpen} onCtxClose={onCtxClose} />
      ) : route === '/skills' ? (
        <Skills connected={conn.ws === 'connected'} skills={skills} openSkill={openSkill}
          onSkillList={onSkillList} onSkillOpen={onSkillOpen} onSkillClose={onSkillClose} />
      ) : route === '/uso' ? (
        <Observatorio connected={conn.ws === 'connected'} usageStats={usageStats} onUsageList={onUsageList} sessions={sessions} rate={rate}
          onOpenSession={(id) => { setActiveSessionId(id); nav('/'); }} />
      ) : route === '/admin' ? (
        <Admin health={health} stats={stats} onHealthList={onHealthList} />
      ) : route === '/docs' ? (
        <Docs />
      ) : isMobile ? (
        <MobileLayout
          sessionsProps={sessionsProps}
          chatProps={chatProps}
          termProps={termProps}
          drawer={drawer} setDrawer={setDrawer}
          termSheet={termSheet} setTermSheet={setTermSheet}
          runningTerm={runningTerm}
        />
      ) : (
        <DesktopLayout
          sessionsProps={sessionsProps}
          chatProps={chatProps}
          termProps={termProps}
          rowRef={rowRef}
          leftW={leftW} rightW={rightW}
          leftCollapsed={leftCollapsed} setLeftCollapsed={setLeftCollapsed}
          rightCollapsed={rightCollapsed} setRightCollapsed={setRightCollapsed}
          startDrag={startDrag}
        />
      )}

      <StatusBar stats={stats} rate={rate} ctxTokens={contextTokens} lastTurn={lastTurn} />
    </div>
  );
}
