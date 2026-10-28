import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { memorizePrompt } from './components/chat/memorize';
import { Sidebar } from './components/chrome/sidebar/Sidebar';
import { MobileTopBar } from './components/chrome/sidebar/MobileTopBar';
import { MobileNavDrawer } from './components/chrome/sidebar/MobileNavDrawer';
import { SessionsPanel } from './components/Sessions';
import { QuotaBanner } from './components/chrome/QuotaBanner';
import { OfflineNotice } from './components/chrome/OfflineNotice';
import { UpdateNotice } from './components/chrome/UpdateNotice';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { Toaster, ConfettiHost } from './components/primitives';
import { BoxHealthHost } from './components/health/BoxHealthHost';
import { bitStateFor } from './components/bit/bit-state';
import type { LinkState } from './components/bit/turn-bit-state';
import { RouteContent } from './app/RouteContent';
import { useAgentNav } from './app/useAgentNav';
import { useCockpit } from './useCockpit';
import { useBoxes } from './cockpit/useBoxes';
import { useRoute } from './useRoute';
import { loadPref } from './lib/persist';
import { SUPABASE_ENABLED } from './lib/supabase';
import { useSupabaseAuth } from './lib/useSupabaseAuth';
import { useProfileHydration } from './lib/profile';
import { useSessionPrefsHydration } from './lib/session-prefs';
import { resolveAuthGate, useSealState } from './app/AuthGateView';
import { relReset } from './lib/time';
import { usePanelResize } from './app/usePanelResize';
import { useTerminalTabs } from './app/useTerminalTabs';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';
import { navRole, NAV } from './components/chrome/nav-routes';
import { FOOTER_NAV } from './components/chrome/sidebar/sidebar-nav';
import { useRoleLanding } from './app/useRoleLanding';
import { useIsMobile } from './app/useIsMobile';
import { useKeyboardOpen } from './app/useKeyboardOpen';
import { useTabTitle } from './app/useTabTitle';
import { useOfflineLatch } from './app/useOfflineLatch';
import { useAppUpdate } from './app/useAppUpdate';
import { usePairingEject } from './app/usePairingEject';
import { useLiveConnection } from './app/useLiveConnection';
import { useQuotaGate } from './app/useQuotaGate';
import { useOverlays } from './app/useOverlays';
import { useChatUrl } from './app/useChatUrl';
import { usageAgentOf } from './components/chrome/usage-agent';
import { withoutBotThreads } from './components/sessions/bot-threads';
import { useCall } from './components/chat/call/useCall';

function CockpitBody() {
  const cockpit = useCockpit();
  const {
    sessions, loading, activeId: activeSessionId, setActiveId: setActiveSessionId,
    messages, phase, terminalBusy, sessionTodos, running, runningAnywhere, stalled, updated, runStart, draft, setDraft, conn, reconnectNow, authRequired, agentOnline, submitToken, rate, planUsage, planBlockedUntil, planReadAt, planNextReadAt, stats, mode, setMode, caps, claudeReady, claudeLogin, onClaudeLoginStart, onClaudeLoginCode, onClaudeLoginCancel, bypass, setBypass, model, setModel, models, onRefreshModels, onRefreshPlanUsage, effort, setEffort, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, slashCommands, term, discoveredTerms, listTerms,
    archived, onUnhide: handleUnhide, contextTokens, contextModel, usageModel, sendCost, liveTurnTokens, turnStartedAt, bgAgents, usage, truncated, lastTurn, lastEnd, searchResults, onSearch,
    skills, usageStats,
    attachments, onUpload, onRemoveAttachment, attPreview, onAttOpen, onAttClose, attThumbs, onAttThumb,
    onSend: handleSend, onApproveWorkflow, onEditUser: editUser, onStop: handleStop, onNew: cockpitNew, marathon, onToggleMarathon, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession,
    onOpenFull, onLoadOlder, onOpenSummary, onHandoff, handoffBusy, onFunnel, funnelBusy,
    queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queuePaused, queueReleaseAt, queueSetPaused, queueRetry, queueRunBg, queueRunNow, queueForce, resumeOffer, resumeRun, orchestratorInfo,
    drops, dropsLoaded, lastDrop, onDropList, onDropPut, onDropRm,
  } = cockpit;

  const { route, chatId, agentId, agentTab, skillId, nav, navChat, navAgent, navSkill } = useRoute();
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
  const role = navRole(caps?.role);
  const isAdmin = role !== 'student';
  const isRoot = role === 'root';
  // Drop privado só existe pra admin (drop-* fora do STUDENT_ALLOWED): sem isso a
  // UI ofereceria um botão que o servidor responde com 'sem permissão'.
  const dropApi = useMemo(
    () => (isAdmin ? { drops, dropsLoaded, lastDrop, onDropList, onDropPut, onDropRm } : undefined),
    [isAdmin, drops, dropsLoaded, lastDrop, onDropList, onDropPut, onDropRm],
  );

  // Produto multi-conta (DR-023): quando o Supabase está ligado (deploy do relay),
  // a sessão vem do login e o access_token alimenta o WS. No loopback (Supabase
  // desligado) este hook fica inerte e o gate de token de sempre vale.
  const sbAuth = useSupabaseAuth((token) => submitToken(token ?? ''));
  useProfileHydration(sbAuth.session?.user.id);
  useSessionPrefsHydration(sbAuth.session?.user.id);

  const { rowRef } = usePanelResize();
  const { terminals, activeTermId, setActiveTermId, handleAddTerm, handleCloseTerm, attachable, attachExisting, runningTerm } = useTerminalTabs(term, discoveredTerms, listTerms);

  const [quotaClosed, setQuotaClosed] = useState(false);
  const quotaGate = useQuotaGate(planUsage, rate);
  const usageAgent = usageAgentOf(model, { activeId: activeSessionId, bots: cockpit.bots });
  // Fechar o aviso vale pra ESTA janela de cota: sem o reset, quem fechou uma vez
  // nunca mais era avisado (nem na janela seguinte) até dar F5.
  const quotaWindow = rate?.resetsAt ?? null;
  useEffect(() => { setQuotaClosed(false); }, [quotaWindow]);

  useLiveConnection({ wsState: conn.ws, reconnectNow });
  const showOffline = useOfflineLatch(conn.ws);
  const [updateClosed, setUpdateClosed] = useState(false);
  const { updateReady, applyUpdate } = useAppUpdate(conn.ws === 'connected');
  const seal = useSealState();
  const ejectPairing = usePairingEject(agentOnline, sbAuth.session?.user.id, conn.ws === 'connected');
  const isMobile = useIsMobile();
  // Só o celular tem teclado por cima da tela; num desktop de janela baixa a
  // heurística acertaria pelo motivo errado e mutilaria o chat à toa.
  const keyboardOpen = useKeyboardOpen() && isMobile;
  useTabTitle(running, updated);
  const link: LinkState = conn.ws === 'connected' ? 'open' : conn.ws === 'reconnecting' ? 'connecting' : 'closed';
  const bitState = bitStateFor({ conn: link, agentOnline, running: runningAnywhere.size > 0, thinking: phase === 'thinking' });

  const { drawer, setDrawer, termSheet, setTermSheet, palette, setPalette, help, setHelp } = useOverlays(route);
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
  const memorizeMsg = useCallback((text: string) => {
    const cur = draftRef.current;
    setDraft((cur ? cur.trimEnd() + '\n\n' : '') + memorizePrompt(text) + '\n\n');
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

  useRoleLanding({ route, chatId, capsKnown: !!caps, role, nav });

  const activeSession = sessions.find((s) => s.id === activeSessionId) || archived.find((s) => s.id === activeSessionId) || null;

  const handleNew = useCallback(() => {
    cockpitNew();
    setDrawer(false);
    nav('/');
  }, [cockpitNew, setDrawer, nav]);

  const call = useCall({ messages, phase, onSend: handleSend, sessionKey: activeSessionId, pendingIds: cockpit.pendingSessionIds });

  const sidebarSessions = useMemo(() => withoutBotThreads(sessions, cockpit.bots), [sessions, cockpit.bots]);
  const sessionsProps = { sessions: sidebarSessions, loading, activeId: activeSessionId, onSelect: selectSession, onNew: handleNew, marathon, onToggleMarathon, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession, onStop: handleStop, archived, onUnhide: handleUnhide, usage, usageModel, cost: sessionCost, running: runningAnywhere, stalled, updated, runStart, searchResults, onSearch, userId: sbAuth.session?.user.id, onFunnel, funnelBusy };
  const chatProps = { session: activeSession, messages, phase, terminalBusy, sessionTodos, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onApproveWorkflow, onStop: handleStop, mode, setMode, caps, claudeReady, claudeLogin, agents: cockpit.agents, onClaudeLoginStart, onClaudeLoginCode, onClaudeLoginCancel, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, selectedMcps, setSelectedMcps, mcpServers, slashCommands, contextTokens, contextModel, sendCost, liveTurnTokens, turnStartedAt, bgAgents, lastTurn, lastEnd, onNew: handleNew, onHandoff, handoffBusy, attachments, onUpload, onRemoveAttachment, attPreview, onAttOpen, onAttClose, attThumbs, onAttThumb, onEditUser: editUser, onQuote: quoteMsg, onMemorize: memorizeMsg, onRename: handleRename, onDelete: handleDeleteSession, onOpenFull, onLoadOlder, onOpenSummary, truncated, onShowHelp: () => setHelp(true), focusSignal, isMobile, onMenu: () => setDrawer(!drawer), keyboardOpen, quotaPaused: quotaGate.paused, quotaResetsAt: quotaGate.resetsAt, queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queuePaused, queueReleaseAt, queueSetPaused, queueRetry, queueRunBg, queueRunNow, queueForce, resumeOffer, resumeRun, orchestratorSessionId: orchestratorInfo?.sessionId, conn: link, call };
  const termProps = { terminals, activeId: activeTermId, onSelect: setActiveTermId, onAdd: handleAddTerm, onClose: handleCloseTerm, term, attachable, onAttach: attachExisting };

  const agent = useAgentNav({
    bots: cockpit.bots, teamLoaded: cockpit.teamLoaded, sessions, running, activeId: activeSessionId, phase, interrupted: cockpit.interrupted, runStart,
    pendingQuestions: cockpit.pendingQuestions, teamMessages: cockpit.teamMessages, connected: conn.ws === 'connected', onTeamGet: cockpit.onTeamGet, onOpenBot: cockpit.onOpenBot,
  }, route, nav, navAgent);
  const agentsProps = {
    views: agent.views, activeId: agent.active?.bot.id ?? null, onNew: agent.openNew,
    onOpen: (id: string) => { agent.open(id); setDrawer(false); },
    paused: cockpit.teamPaused,
  };
  const openPalette = () => { setDrawer(false); setPalette(true); };
  const usageDock = { usageAgent, planUsage, planBlockedUntil, planReadAt, planNextReadAt, onRefreshPlanUsage, grokUsage: cockpit.grokUsage, onRefreshGrokUsage: cockpit.onRefreshGrokUsage, quotaWarn: quotaGate.warn, quotaPaused: quotaGate.paused, quotaResetsAt: quotaGate.resetsAt, stats };
  const account = { userId: sbAuth.session?.user.id, onSignOut: SUPABASE_ENABLED ? sbAuth.signOut : undefined, onChangePassword: SUPABASE_ENABLED ? sbAuth.changePassword : undefined, drops: dropApi };

  const drawerNav = drawer ? (
    <Sidebar
      route={route} nav={(to) => { setDrawer(false); nav(to); }} role={role}
      onNew={handleNew} onPalette={openPalette}
      bitState={bitState} conn={conn.ws} usage={usageDock} account={account}
      agents={agentsProps} sessions={<SessionsPanel {...sessionsProps} embedded onCloseMobile={() => setDrawer(false)} />}
      drawer={{ onClose: () => setDrawer(false) }}
    />
  ) : null;
  const chatSurface = route === '/';
  const pageTitle = FOOTER_NAV.find((i) => i.to === route || route.startsWith(`${i.to}/`))?.label ?? NAV.find((n) => n.to === route)?.label ?? 'Deck';

  const gate = resolveAuthGate({ sbAuth, seal, ejectPairing, authRequired, submitToken });
  if (gate) return gate;

  return (
    // Safe-area nos quatro lados: com `viewport-fit=cover` o notch em landscape
    // come a lateral, e sem left/right o header e o composer ficam sob o entalhe.
    <div
      className="relative flex h-full flex-col bg-neutral-950"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <CommandPalette
        open={palette} onClose={() => setPalette(false)}
        nav={nav} onNew={handleNew}
        mode={mode} setMode={setMode}
        sessions={sessions} onSelectSession={selectSession}
        running={running} onStop={handleStop} onFocusComposer={() => setFocusSignal((n) => n + 1)}
        onSeedComposer={(text) => { setDraft(text); setFocusSignal((n) => n + 1); }}
        onShowHelp={() => setHelp(true)}
        role={role}
      />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <div className="flex min-h-0 flex-1">
        {!isMobile && (
          <Sidebar
            route={route} nav={nav} role={role} onNew={handleNew} onPalette={() => setPalette(true)}
            bitState={bitState} conn={conn.ws} usage={usageDock} account={account}
            agents={agentsProps} sessions={<SessionsPanel {...sessionsProps} embedded />}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {isMobile && !chatSurface && (
            <MobileTopBar onMenu={() => setDrawer(!drawer)} menuOpen={drawer} title={pageTitle} />
          )}
          {/* Âncora de altura zero no fluxo: o aviso pende daqui, logo abaixo do topo da coluna. */}
          <div className="relative z-40">
            <OfflineNotice show={showOffline} onReconnect={reconnectNow} authRejected={SUPABASE_ENABLED && authRequired} />
            {/* Um de cada vez na mesma âncora, e offline ganha: sem servidor não há
                versão nova pra buscar, e recarregar ali só daria página em branco. */}
            <UpdateNotice show={updateReady && !updateClosed && !showOffline} onApply={applyUpdate} onDismiss={() => setUpdateClosed(true)} />
          </div>

          {/* O aviso de cota do desktop: no celular quem avisa é o anel de uso no topo,
              então nada flutua sobre o thread (A1). */}
          {!isMobile && quotaGate.warn && !quotaClosed && rate && (
            <div className="flex shrink-0 justify-end px-3 pt-1.5">
              <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />
            </div>
          )}

          <RouteContent
            route={route} agentRoute={{ id: agentId, tab: agentTab, open: navAgent }} skillRoute={{ id: skillId, open: navSkill }} isMobile={isMobile} isAdmin={isAdmin} isRoot={isRoot} connected={conn.ws === 'connected'}
            cockpit={cockpit} chatProps={chatProps} termProps={termProps}
            onOpenSession={selectSession} agent={agent}
            onOpenAgentChat={(m) => { handleNew(); setModel(m); nav('/'); }}
            layout={{ rowRef }}
            mobile={{ drawer, setDrawer, termSheet, setTermSheet, runningTerm, drawerNav }}
            role={role} nav={nav} account={account} usageDock={usageDock}
          />
        </div>
      </div>
      {isMobile && !chatSurface && (
        <MobileNavDrawer open={drawer} onClose={() => setDrawer(false)}>{drawerNav}</MobileNavDrawer>
      )}
      <BoxHealthHost />
      <Toaster />
      <ConfettiHost />
    </div>
  );
}

// The box is the identity of everything the cockpit holds in memory (sessions,
// terminals, queues): switching remounts the tree so none of it leaks across boxes.
export function CockpitApp() {
  const { current } = useBoxes();
  return <CockpitBody key={current ?? ''} />;
}
