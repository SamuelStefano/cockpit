import { useState, useMemo, useEffect } from 'react';
import { StatusBar } from './components/StatusBar';
import { Header } from './components/chrome/Header';
import { QuotaBanner } from './components/chrome/QuotaBanner';
import { OfflineNotice } from './components/chrome/OfflineNotice';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { RouteContent } from './app/RouteContent';
import { useCockpit } from './useCockpit';
import { useRoute } from './useRoute';
import { SUPABASE_ENABLED } from './lib/supabase';
import { useSupabaseAuth } from './lib/useSupabaseAuth';
import { useProfileHydration } from './lib/profile';
import { resolveAuthGate } from './app/AuthGateView';
import { relReset } from './lib/time';
import { usePanelResize } from './app/usePanelResize';
import { useTerminalTabs } from './app/useTerminalTabs';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';
import { useIsMobile } from './app/useIsMobile';
import { useTabTitle } from './app/useTabTitle';
import { useOfflineLatch } from './app/useOfflineLatch';
import { usePairingEject } from './app/usePairingEject';

export function CockpitApp() {
  const cockpit = useCockpit();
  const {
    sessions, loading, activeId: activeSessionId, setActiveId: setActiveSessionId,
    messages, phase, running, stalled, updated, runStart, draft, setDraft, conn, authRequired, agentOnline, submitToken, rate, planUsage, stats, mode, setMode, caps, claudeReady, bypass, setBypass, model, setModel, models, onRefreshModels, selectedSkills, setSelectedSkills, slashCommands, term, discoveredTerms, listTerms,
    archived, onUnhide: handleUnhide, contextTokens, liveTurnTokens, turnStartedAt, usage, truncated, lastTurn, lastEnd, searchResults, onSearch,
    skills, usageStats,
    attachments, onUpload, onRemoveAttachment,
    onSend: handleSend, onEditUser: editUser, onStop: handleStop, onNew: cockpitNew, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession,
    onOpenFull, onOpenSummary,
  } = cockpit;

  const { route, nav } = useRoute();
  // Default-deny: sem caps (ainda não chegou) = não-admin. No T3 o caps vem do
  // relay (papel da conta no JWT); no loopback, do token/role local.
  const isAdmin = caps?.role === 'admin' || caps?.role === 'root';

  // Produto multi-conta (DR-023): quando o Supabase está ligado (deploy do relay),
  // a sessão vem do login e o access_token alimenta o WS. No loopback (Supabase
  // desligado) este hook fica inerte e o gate de token de sempre vale.
  const sbAuth = useSupabaseAuth((token) => submitToken(token ?? ''));
  useProfileHydration(sbAuth.session?.user.id);

  const { rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag } = usePanelResize();
  const { terminals, activeTermId, setActiveTermId, handleAddTerm, handleCloseTerm, attachable, attachExisting, runningTerm } = useTerminalTabs(term, discoveredTerms, listTerms);

  const [quotaClosed, setQuotaClosed] = useState(false);
  // Só alerta quando o próprio CLI sinaliza near-limit/limite (status !== 'allowed').
  // O CLI não envia % de uso; 'allowed' = longe do teto, então não pisca à toa.
  const quota = !!rate && rate.status !== 'allowed' && !quotaClosed;

  const showOffline = useOfflineLatch(conn.ws);
  const ejectPairing = usePairingEject(agentOnline, sbAuth.session?.user.id, conn.ws === 'connected');
  const isMobile = useIsMobile();
  useTabTitle(running, updated);

  const [drawer, setDrawer] = useState(false);
  const [termSheet, setTermSheet] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  useGlobalShortcuts({ sessions, activeSessionId, setActiveSessionId, updated, nav, setPalette, setHelp });

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

  const sessionsProps = { sessions, loading, activeId: activeSessionId, onSelect: setActiveSessionId, onNew: handleNew, onRename: handleRename, onDescribe: handleDescribe, onClose: handleCloseSession, onDelete: handleDeleteSession, onStop: handleStop, archived, onUnhide: handleUnhide, usage, cost: sessionCost, running, stalled, updated, runStart, searchResults, onSearch };
  // Pausa o envio perto do teto do plano (5h) pra não estourar e perder trabalho:
  // a fila persistida não dispara e o composer trava até a janela resetar.
  const quotaPaused = !!planUsage && planUsage.fiveHour >= 99.5;
  const chatProps = { session: activeSession, messages, phase, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop, mode, setMode, caps, claudeReady, bypass, setBypass, model, setModel, models, onRefreshModels, skills, selectedSkills, setSelectedSkills, slashCommands, contextTokens, liveTurnTokens, turnStartedAt, lastTurn, lastEnd, onNew: handleNew, attachments, onUpload, onRemoveAttachment, onEditUser: editUser, onQuote: quoteMsg, onOpenFull, onOpenSummary, truncated, onShowHelp: () => setHelp(true), focusSignal, isMobile, quotaPaused, quotaResetsAt: planUsage?.resetsAt ?? null };
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
        sessions={sessions} onSelectSession={setActiveSessionId}
        running={running} onStop={handleStop} onFocusComposer={() => setFocusSignal((n) => n + 1)}
        onShowHelp={() => setHelp(true)}
      />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <Header conn={conn} isMobile={isMobile} onMenu={() => setDrawer(true)} route={route} nav={nav} onPalette={() => setPalette(true)} planUsage={planUsage} onNew={handleNew} isAdmin={isAdmin} userId={sbAuth.session?.user.id} onSignOut={SUPABASE_ENABLED ? sbAuth.signOut : undefined} />

      {quota && rate && <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />}
      <OfflineNotice show={showOffline} />

      <RouteContent
        route={route} isMobile={isMobile} isAdmin={isAdmin} connected={conn.ws === 'connected'}
        cockpit={cockpit} sessionsProps={sessionsProps} chatProps={chatProps} termProps={termProps}
        onOpenSession={(id) => { setActiveSessionId(id); nav('/'); }}
        layout={{ rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag }}
        mobile={{ drawer, setDrawer, termSheet, setTermSheet, runningTerm }}
      />

      <StatusBar stats={stats} rate={rate} ctxTokens={contextTokens} lastTurn={lastTurn} />
    </div>
  );
}
