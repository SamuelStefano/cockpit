import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { StatusBar } from './components/StatusBar';
import { Header } from './components/chrome/Header';
import { QuotaBanner } from './components/chrome/QuotaBanner';
import { OfflineNotice } from './components/chrome/OfflineNotice';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { Toaster, ConfettiHost } from './components/primitives';
import { RouteContent } from './app/RouteContent';
import { useCockpit } from './useCockpit';
import { useRoute } from './useRoute';
import { loadPref } from './lib/persist';
import { SUPABASE_ENABLED } from './lib/supabase';
import { useSupabaseAuth } from './lib/useSupabaseAuth';
import { useProfileHydration } from './lib/profile';
import { useSessionPrefsHydration } from './lib/session-prefs';
import { resolveAuthGate } from './app/AuthGateView';
import { relReset } from './lib/time';
import { usePanelResize } from './app/usePanelResize';
import { useTerminalTabs } from './app/useTerminalTabs';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';
import { useIsMobile } from './app/useIsMobile';
import { useKeyboardOpen } from './app/useKeyboardOpen';
import { useTabTitle } from './app/useTabTitle';
import { useOfflineLatch } from './app/useOfflineLatch';
import { usePairingEject } from './app/usePairingEject';
import { useLiveConnection } from './app/useLiveConnection';
import { useQuotaGate } from './app/useQuotaGate';
import { useOverlays } from './app/useOverlays';
import { useChatUrl } from './app/useChatUrl';

export function CockpitApp() {
  const cockpit = useCockpit();
  const {
    sessions, loading, activeId: activeSessionId, setActiveId: setActiveSessionId,
    messages, phase, terminalBusy, sessionTodos, followups, dismissFollowups, running, stalled, updated, runStart, draft, setDraft, conn, reconnectNow, authRequired, agentOnline, submitToken, rate, planUsage, stats, mode, setMode, caps, claudeReady, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, slashCommands, term, discoveredTerms, listTerms,
    archived, onUnhide: handleUnhide, contextTokens, liveTurnTokens, turnStartedAt, bgAgents, usage, truncated, lastTurn, lastEnd, searchResults, onSearch,
    skills, usageStats,
    attachments, onUpload, onRemoveAttachment, attPreview, onAttOpen, onAttClose, attThumbs, onAttThumb,
    onSend: handleSend, onEditUser: editUser, onStop: handleStop, onNew: cockpitNew, marathon, onToggleMarathon, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession,
    onOpenFull, onLoadOlder, onOpenSummary, onHandoff, handoffBusy,
    queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queuePaused, queueSetPaused, queueRetry, queueRunBg, queueRunNow, queueForce,
  } = cockpit;

  const { route, chatId, nav, navChat } = useRoute();
  // Escolha explícita do usuário empilha history (voltar volta pro chat anterior);
  // trocas derivadas passam pelo useChatUrl com replace.
  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    if (id.startsWith('new-')) nav('/');
    else navChat(id);
  }, [setActiveSessionId, nav, navChat]);
  useChatUrl({ route, chatId, navChat, activeId: activeSessionId, setActiveId: setActiveSessionId, sessions, archived });
  // Default-deny: sem caps (ainda não chegou) = não-admin. No T3 o caps vem do
  // relay (papel da conta no JWT); no loopback, do token/role local.
  const isAdmin = caps?.role === 'admin' || caps?.role === 'root';

  // Produto multi-conta (DR-023): quando o Supabase está ligado (deploy do relay),
  // a sessão vem do login e o access_token alimenta o WS. No loopback (Supabase
  // desligado) este hook fica inerte e o gate de token de sempre vale.
  const sbAuth = useSupabaseAuth((token) => submitToken(token ?? ''));
  useProfileHydration(sbAuth.session?.user.id);
  useSessionPrefsHydration(sbAuth.session?.user.id);

  const { rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag } = usePanelResize();
  const { terminals, activeTermId, setActiveTermId, handleAddTerm, handleCloseTerm, attachable, attachExisting, runningTerm } = useTerminalTabs(term, discoveredTerms, listTerms);

  const [quotaClosed, setQuotaClosed] = useState(false);
  const quotaGate = useQuotaGate(planUsage, rate);

  useLiveConnection({ wsState: conn.ws, reconnectNow });
  const showOffline = useOfflineLatch(conn.ws);
  const ejectPairing = usePairingEject(agentOnline, sbAuth.session?.user.id, conn.ws === 'connected');
  const isMobile = useIsMobile();
  // Só o celular tem teclado por cima da tela; num desktop de janela baixa a
  // heurística acertaria pelo motivo errado e mutilaria o chat à toa.
  const keyboardOpen = useKeyboardOpen() && isMobile;
  useTabTitle(running, updated);

  const { drawer, setDrawer, termSheet, setTermSheet, routeMenu, setRouteMenu, palette, setPalette, help, setHelp } = useOverlays(route);
  const [focusSignal, setFocusSignal] = useState(0);

  useGlobalShortcuts({ sessions, activeSessionId, setActiveSessionId: selectSession, updated, nav, setPalette, setHelp });

  // Citar uma mensagem: vira blockquote no topo do rascunho atual (trunca longos).
  // Ref + useCallback: identidade estável pro memo do MessageRow (setDraft não
  // aceita updater funcional — é keyed pela sessão ativa no hook).
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const quoteMsg = useCallback((text: string) => {
    const clipped = text.length > 280 ? text.slice(0, 280).trimEnd() + '…' : text;
    const quoted = clipped.split('\n').map((l) => '> ' + l).join('\n');
    const cur = draftRef.current;
    setDraft((cur ? cur.trimEnd() + '\n\n' : '') + quoted + '\n\n');
    setFocusSignal((n) => n + 1);
  }, [setDraft]);

  // Custo estimado acumulado por sessão (do observatório) → chip no sidebar.
  const sessionCost = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of usageStats?.sessions ?? []) m[s.sessionId] = s.costUsd;
    return m;
  }, [usageStats]);

  // Pós-F5 restaura o chat da URL (/c/<id>), senão a última sessão aberta
  // (persistida); só cai na mais recente se nenhuma existir mais ou no 1º acesso.
  useEffect(() => {
    if (activeSessionId || !sessions.length) return;
    const has = (id: string) => !!id && (sessions.some((s) => s.id === id) || archived.some((s) => s.id === id));
    const saved = loadPref('activeId', '');
    const pick = has(chatId) ? chatId : has(saved) ? saved : sessions[0].id;
    setActiveSessionId(pick);
  }, [activeSessionId, sessions, archived, chatId, setActiveSessionId]);

  // Não-admin não fica preso na URL /admin (só redireciona quando caps já chegou,
  // pra não chutar pra fora antes de saber o papel).
  useEffect(() => {
    if (route === '/admin' && caps && !isAdmin) nav('/');
  }, [route, caps, isAdmin, nav]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || archived.find((s) => s.id === activeSessionId) || null;

  const handleNew = () => {
    cockpitNew();
    setDrawer(false);
    nav('/');
  };

  const sessionsProps = { sessions, loading, activeId: activeSessionId, onSelect: selectSession, onNew: handleNew, marathon, onToggleMarathon, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession, onStop: handleStop, archived, onUnhide: handleUnhide, usage, cost: sessionCost, running, stalled, updated, runStart, searchResults, onSearch, userId: sbAuth.session?.user.id };
  const chatProps = { session: activeSession, messages, phase, terminalBusy, sessionTodos, followups, onDismissFollowups: dismissFollowups, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop, mode, setMode, caps, claudeReady, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, selectedMcps, setSelectedMcps, mcpServers, slashCommands, contextTokens, liveTurnTokens, turnStartedAt, bgAgents, lastTurn, lastEnd, onNew: handleNew, onHandoff, handoffBusy, attachments, onUpload, onRemoveAttachment, attPreview, onAttOpen, onAttClose, attThumbs, onAttThumb, onEditUser: editUser, onQuote: quoteMsg, onRename: handleRename, onOpenFull, onLoadOlder, onOpenSummary, truncated, onShowHelp: () => setHelp(true), focusSignal, isMobile, keyboardOpen, quotaPaused: quotaGate.paused, quotaResetsAt: quotaGate.resetsAt, queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queuePaused, queueSetPaused, queueRetry, queueRunBg, queueRunNow, queueForce };
  const termProps = { terminals, activeId: activeTermId, onSelect: setActiveTermId, onAdd: handleAddTerm, onClose: handleCloseTerm, term, attachable, onAttach: attachExisting };

  const gate = resolveAuthGate({ sbAuth, ejectPairing, authRequired, submitToken });
  if (gate) return gate;

  return (
    <div
      className="relative flex h-full flex-col bg-neutral-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <CommandPalette
        open={palette} onClose={() => setPalette(false)}
        nav={nav} onNew={handleNew}
        mode={mode} setMode={setMode}
        sessions={sessions} onSelectSession={selectSession}
        running={running} onStop={handleStop} onFocusComposer={() => setFocusSignal((n) => n + 1)}
        onSeedComposer={(text) => { setDraft(text); setFocusSignal((n) => n + 1); }}
        onShowHelp={() => setHelp(true)}
      />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <Header conn={conn} isMobile={isMobile} onMenu={() => setDrawer(true)} route={route} nav={nav} onPalette={() => setPalette(true)} planUsage={planUsage} quotaWarn={quotaGate.warn} quotaPaused={quotaGate.paused} quotaResetsAt={quotaGate.resetsAt} onNew={handleNew} isAdmin={isAdmin} routeMenuOpen={routeMenu} setRouteMenuOpen={setRouteMenu} userId={sbAuth.session?.user.id} onSignOut={SUPABASE_ENABLED ? sbAuth.signOut : undefined} />

      <OfflineNotice show={showOffline} />

      <RouteContent
        route={route} isMobile={isMobile} isAdmin={isAdmin} connected={conn.ws === 'connected'}
        cockpit={cockpit} sessionsProps={sessionsProps} chatProps={chatProps} termProps={termProps}
        onOpenSession={selectSession}
        onAnalyzeNotes={(text) => {
          handleNew();
          setDraft(`Analise estas anotações soltas e destile num contexto/memória estruturado e reutilizável (markdown bem organizado). Se fizer sentido, salve em memory/. Anotações:\n\n${text}`);
          nav('/');
        }}
        layout={{ rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag }}
        mobile={{ drawer, setDrawer, termSheet, setTermSheet, runningTerm }}
      />

      {/* O aviso de cota do desktop mora na StatusBar: no celular quem avisa é a
          UsageBar do header — nada flutua sobre o thread (A1). */}
      {!isMobile && (
        <StatusBar
          stats={stats} rate={rate} ctxTokens={contextTokens} lastTurn={lastTurn}
          quota={quotaGate.warn && !quotaClosed && rate ? <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} /> : null}
        />
      )}
      <Toaster />
      <ConfettiHost />
    </div>
  );
}
